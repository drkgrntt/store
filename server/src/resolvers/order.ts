import {
  Address,
  Order,
  OrderProduct,
  Product,
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
  async allOrders(): Promise<Order[]> {
    const orders = await Order.findAll({
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
    @Arg("totalCost") amount: number,
    @Arg("clientSecret", { nullable: true }) clientSecret?: string
  ) {
    const config: Stripe.StripeConfig = { apiVersion: "2022-08-01" };
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, config);

    let paymentIntent;

    if (clientSecret) {
      const [paymentIntentId] = clientSecret.split("_secret");
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent?.status !== "succeeded") {
        paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
          amount,
        });
      }
    } else {
      paymentIntent = await stripe.paymentIntents.create({
        amount,
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
    const transaction = await sequelize.transaction();

    try {
      const [paymentIntentId] = clientSecret.split("_secret");

      const order = await Order.create(
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
      }

      return order;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  @Mutation(() => Order)
  @UseMiddleware(isAdmin)
  async updateOrder(
    @Arg("id") id: string,
    @Arg("isShipped", { nullable: true }) isShipped?: boolean,
    @Arg("isComplete", { nullable: true }) isComplete?: boolean,
    @Arg("trackingNumber", { nullable: true }) trackingNumber?: string
  ): Promise<Order> {
    const order = await Order.findOne({ where: { id } });
    if (!order) throw new Error("Invalid id");

    if (isShipped !== undefined) order.isShipped = isShipped;
    if (isComplete !== undefined) order.isComplete = isComplete;
    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;

    await order.save();

    return order;
  }
}
