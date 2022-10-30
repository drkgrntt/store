import {
  Address,
  Order,
  OrderProduct,
  Product,
  ProductImage,
  User,
  UserProduct,
} from "../models";
import {
  Arg,
  Ctx,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { isAuth } from "../middleware/isAuth";
import { Context } from "../types";
import { isAdmin } from "../middleware/isAdmin";
import Stripe from "stripe";
import { ADMIN_NEW_ORDER, CUSTOMER_NEW_ORDER, sendEmail } from "../utils/email";
import { addressToString } from "../utils";
import { Op, WhereOptions } from "sequelize";

@Resolver(OrderProduct)
export class OrderedProductResolver {
  @FieldResolver(() => Product)
  async product(@Root() orderedProduct: OrderProduct): Promise<Product> {
    if (orderedProduct.product) return orderedProduct.product;
    const product = await Product.findOne({
      where: { id: orderedProduct.productId },
    });
    if (!product)
      throw new Error("Ordered product needs a product associated.");
    return product;
  }
}

@Resolver(Order)
export class OrderResolver {
  @FieldResolver(() => Boolean)
  isShipped(@Root() order: Order): boolean {
    return !!order.shippedOn;
  }

  @FieldResolver(() => Boolean)
  isComplete(@Root() order: Order): boolean {
    return !!order.completedOn;
  }

  @FieldResolver(() => User)
  async user(@Root() order: Order): Promise<User> {
    if (order.user) return order.user;
    const user = await User.findOne({
      where: { id: order.userId },
    });
    if (!user) throw new Error("Order needs a user.");
    return user;
  }

  @FieldResolver(() => Address)
  async address(@Root() order: Order): Promise<Address> {
    if (order.address) return order.address;
    const address = await Address.findOne({
      where: { id: order.addressId },
    });
    if (!address) throw new Error("Order needs an address.");
    return address;
  }

  @FieldResolver(() => [OrderProduct])
  async orderedProducts(@Root() order: Order): Promise<OrderProduct[]> {
    if (order.orderedProducts?.length) return order.orderedProducts;
    const orderedProducts = await OrderProduct.findAll({
      where: { orderId: order.id },
      include: { model: Product },
    });
    return orderedProducts;
  }

  @FieldResolver(() => Number)
  async totalCost(@Root() order: Order): Promise<number> {
    if (!order.orderedProducts?.length) {
      order.orderedProducts = await OrderProduct.findAll({
        where: { orderId: order.id },
        include: { model: Product },
      });
    }
    return order.orderedProducts.reduce((total, orderedProduct) => {
      return total + orderedProduct.price * orderedProduct.count;
    }, 0);
  }

  @Query(() => [Order])
  @UseMiddleware(isAdmin)
  async allOrders(
    @Arg("isShipped", { nullable: true }) isShipped: boolean,
    @Arg("isComplete", { nullable: true }) isComplete: boolean
  ): Promise<Order[]> {
    let where: WhereOptions = {};

    if (typeof isShipped !== "undefined")
      where.shippedOn = isShipped ? { [Op.not]: null } : null;
    if (typeof isComplete !== "undefined")
      where.completedOn = isComplete ? { [Op.not]: null } : null;

    const orders = await Order.findAll({
      where,
      order: [["createdAt", "asc"]],
    });

    return orders;
  }

  @Query(() => [Order])
  @UseMiddleware(isAuth)
  async orders(@Ctx() { me }: Context): Promise<Order[]> {
    const orders = await Order.findAll({
      where: { userId: me.id },
      order: [["createdAt", "asc"]],
    });
    return orders;
  }

  @Query(() => Order, { nullable: true })
  @UseMiddleware(isAuth)
  async order(
    @Ctx() { me }: Context,
    @Arg("id") id: string
  ): Promise<Order | null> {
    const where: { id: string; userId?: string } = { id };
    if (!me.isAdmin) where.userId = me.id;
    const order = await Order.findOne({
      where,
    });
    return order;
  }

  @Query(() => String, { nullable: true })
  @UseMiddleware(isAuth)
  async clientSecret(
    @Ctx() { me }: Context,
    @Arg("totalCost") amount: number,
    @Arg("clientSecret", { nullable: true }) clientSecret?: string
  ) {
    const cart = await UserProduct.findAll({
      where: { userId: me.id },
      include: Product,
    });
    const description = cart.reduce((current, item) => {
      return (
        current +
        `${item.product.title} - $${(item.product.price / 100).toFixed(2)} x${
          item.count
        } \n`
      );
    }, "");

    const config: Stripe.StripeConfig = { apiVersion: "2022-08-01" };
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, config);

    let paymentIntent;

    if (clientSecret) {
      const [paymentIntentId] = clientSecret.split("_secret");
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent?.status !== "succeeded") {
        paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
          amount,
          description,
        });
      }
    } else {
      paymentIntent = await stripe.paymentIntents.create({
        amount,
        description,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
      });
    }

    return paymentIntent.client_secret;
  }

  @Query(() => Boolean)
  @UseMiddleware(isAuth)
  async paymentSucceeded(@Arg("clientSecret") clientSecret: string) {
    const config: Stripe.StripeConfig = { apiVersion: "2022-08-01" };
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, config);

    const [paymentIntentId] = clientSecret.split("_secret");

    const existingOrder = await Order.findOne({ where: { paymentIntentId } });
    if (existingOrder) false;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent?.status === "succeeded";
  }

  @Mutation(() => Order)
  @UseMiddleware(isAuth)
  async placeOrder(
    @Ctx() { me, sequelize }: Context,
    @Arg("addressId") addressId: string,
    @Arg("clientSecret") clientSecret: string,
    @Arg("dryRun", { nullable: true }) dryRun?: boolean
  ): Promise<Order> {
    if (!dryRun) {
      const paymentSucceeded = await this.paymentSucceeded(clientSecret);
      if (!paymentSucceeded)
        throw new Error("The payment for this order did not succeed.");
    }

    const transaction = await sequelize.transaction();

    try {
      const [paymentIntentId] = clientSecret.split("_secret");

      let order = await Order.create(
        { addressId, userId: me.id, paymentIntentId },
        { transaction }
      );

      const cart = await UserProduct.findAll({
        include: Product,
        where: { userId: me.id },
        transaction,
      });

      const orderedProducts = await Promise.all(
        // Convert all cart items into order items
        cart.map(async (userProduct) => {
          const orderProduct = await OrderProduct.create(
            {
              orderId: order.id,
              productId: userProduct.productId,
              count: userProduct.count,
              price: userProduct.product.price,
            },
            { transaction }
          );

          // Decrement product quantity
          const newQuantity = userProduct.product.quantity - orderProduct.count;
          if (newQuantity < 0) {
            userProduct.product.quantity = 0;
          } else {
            userProduct.product.quantity = newQuantity;
          }
          await userProduct.product.save({ transaction });

          // Remove from cart
          await userProduct.destroy({ transaction });

          return orderProduct;
        })
      );
      order.orderedProducts = orderedProducts;

      if (dryRun) {
        await transaction.rollback();
      } else {
        await transaction.commit();

        order = (await Order.findOne({
          where: { id: order.id },
          include: [
            { model: Address },
            {
              model: OrderProduct,
              include: [{ model: Product, include: [ProductImage] }],
            },
          ],
        })) as Order;

        const emailVariables = {
          email: me.email,
          orderId: order.id,
          stripePaymentUrl: `https://dashboard.stripe.com/payments/${order.paymentIntentId}`,
          address: addressToString(order.address),
          productList: order.orderedProducts.map((op) => ({
            imageUrl: (
              op.product.images.find((image) => image.primary) ??
              op.product.images[0]
            ).url,
            id: op.productId,
            title: op.product.title,
            cost: "$" + (op.price / 100).toFixed(2),
            quantity: op.count.toString(),
          })),
          totalCost: (
            order.orderedProducts.reduce(
              (total, op) => total + op.price * op.count,
              0
            ) / 100
          ).toFixed(2),
        };

        await sendEmail(ADMIN_NEW_ORDER, emailVariables);
        await sendEmail(CUSTOMER_NEW_ORDER, emailVariables);
      }

      return order;
    } catch (err) {
      try {
        await transaction.rollback();
      } catch {}
      throw err;
    }
  }

  @Mutation(() => Order)
  @UseMiddleware(isAdmin)
  async updateOrder(
    @Arg("id") id: string,
    @Arg("shippedOn", { nullable: true }) shippedOn?: Date,
    @Arg("completedOn", { nullable: true }) completedOn?: Date,
    @Arg("trackingNumber", { nullable: true }) trackingNumber?: string
  ): Promise<Order> {
    const order = await Order.findOne({ where: { id } });
    if (!order) throw new Error("Invalid id");

    if (shippedOn !== undefined) order.shippedOn = shippedOn;
    if (completedOn !== undefined) order.completedOn = completedOn;
    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;

    await order.save();

    return order;
  }
}
