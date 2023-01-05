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
  Field,
  FieldResolver,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { isAuth } from "../middleware/isAuth";
import { Context, Paginated } from "../types";
import { isAdmin } from "../middleware/isAdmin";
import Stripe from "stripe";
import {
  ADMIN_NEW_ORDER,
  CUSTOMER_NEW_ORDER,
  sendEmail,
  CONTACT_MESSAGE,
  ORDER_HAS_SHIPPED,
} from "../utils/email";
import { addressToString } from "../utils";
import { Op, Transaction, WhereOptions } from "sequelize";

@Resolver(OrderProduct)
export class OrderedProductResolver {
  @FieldResolver(() => Product)
  async product(
    @Root() orderedProduct: OrderProduct,
    @Ctx() { productLoader }: Context
  ): Promise<Product> {
    const product = await productLoader.load(orderedProduct.productId);
    if (!product)
      throw new Error("Ordered product needs a product associated.");
    return product;
  }
}

@ObjectType()
class OrderPage implements Paginated<Order> {
  @Field()
  hasMore: boolean;

  @Field({ nullable: true })
  nextPage?: number;

  @Field(() => [Order])
  edges: Order[];
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
  async address(
    @Root() order: Order,
    @Ctx() { addressLoader }: Context
  ): Promise<Address> {
    const address = await addressLoader.load(order.addressId);
    return address;
  }

  @FieldResolver(() => [OrderProduct])
  async orderedProducts(
    @Root() order: Order,
    @Ctx() { orderProductIdsByOrderLoader, orderProductLoader }: Context
  ): Promise<OrderProduct[]> {
    const userProductIds = await orderProductIdsByOrderLoader.load(order.id);
    const orderedProducts = (await orderProductLoader.loadMany(
      userProductIds || []
    )) as OrderProduct[];
    return orderedProducts;
  }

  @FieldResolver(() => Number)
  async subTotal(@Root() order: Order): Promise<number> {
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

  @FieldResolver(() => Number)
  async totalCost(@Root() order: Order): Promise<number> {
    const subTotal = await this.subTotal(order);
    const { shippingCost, taxRate } = order;
    const tax = Math.floor(subTotal * taxRate);
    return subTotal + shippingCost + tax;
  }

  @Query(() => OrderPage)
  @UseMiddleware(isAdmin)
  async allOrders(
    @Arg("page", { nullable: true }) page: number = 0,
    @Arg("perPage", { nullable: true }) perPage: number = 30,
    @Arg("isShipped", { nullable: true }) isShipped: boolean,
    @Arg("isComplete", { nullable: true }) isComplete: boolean,
    @Ctx() { orderLoader }: Context
  ): Promise<OrderPage> {
    let where: WhereOptions = {};

    if (typeof isShipped !== "undefined")
      where.shippedOn = isShipped ? { [Op.not]: null } : null;
    if (typeof isComplete !== "undefined")
      where.completedOn = isComplete ? { [Op.not]: null } : null;

    const found = await Order.findAll({
      where,
      limit: perPage + 1,
      offset: page * perPage,
      order: [["createdAt", "desc"]],
    });

    const orders = found.slice(0, perPage);
    const hasMore = found.length > perPage;

    orders.forEach((order) => orderLoader.prime(order.id, order));

    return {
      edges: orders,
      hasMore,
      nextPage: hasMore ? page + 1 : undefined,
    };
  }

  @Query(() => [Order])
  @UseMiddleware(isAuth)
  async orders(
    @Ctx() { me }: Context,
    @Ctx() { orderIdsByUserLoader, orderLoader }: Context
  ): Promise<Order[]> {
    const orderIds = await orderIdsByUserLoader.load(me.id);
    const orders = (await orderLoader.loadMany(orderIds || [])) as Order[];
    return orders.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }

  @Query(() => Order, { nullable: true })
  @UseMiddleware(isAuth)
  async order(
    @Ctx() { me, orderLoader }: Context,
    @Arg("id") id: string
  ): Promise<Order | null> {
    const where: { id: string; userId?: string } = { id };
    if (!me.isAdmin) where.userId = me.id;
    const order = await Order.findOne({
      where,
    });
    if (order) orderLoader.prime(order.id, order);
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
    let description = cart.reduce((current, item) => {
      return (
        current +
        `${item.product.title} - $${(item.product.price / 100).toFixed(2)} x${
          item.count
        } \n`
      );
    }, "");
    description += `Shipping - $${(Order.currentShippingCost / 100).toFixed(
      2
    )} \n`;
    const subTotal = cart.reduce(
      (st, item) => st + item.product.price * item.count,
      0
    );
    description += `Tax - $${(
      Math.floor(Order.currentTaxRate * subTotal) / 100
    ).toFixed(2)} \n`;

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
  async paymentSucceeded(
    @Arg("clientSecret") clientSecret: string,
    transaction?: Transaction
  ) {
    const config: Stripe.StripeConfig = { apiVersion: "2022-08-01" };
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, config);

    const [paymentIntentId] = clientSecret.split("_secret");

    const existingOrder = await Order.findOne({
      where: { paymentIntentId },
      transaction,
    });
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
    @Arg("notes", { nullable: true }) notes?: string,
    @Arg("dryRun", { nullable: true }) dryRun?: boolean
  ): Promise<Order> {
    const transaction = await sequelize.transaction();

    try {
      if (!dryRun) {
        const paymentSucceeded = await this.paymentSucceeded(
          clientSecret,
          transaction
        );
        if (!paymentSucceeded)
          throw new Error("The payment for this order did not succeed.");
      }

      const [paymentIntentId] = clientSecret.split("_secret");

      let order = await Order.create(
        {
          addressId,
          userId: me.id,
          paymentIntentId,
          notes,
          taxRate: Order.currentTaxRate,
          shippingCost: Order.currentShippingCost,
        },
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
          const { product } = userProduct;
          const orderProduct = await OrderProduct.create(
            {
              orderId: order.id,
              productId: product.id,
              count: userProduct.count,
              price: product.price,
            },
            { transaction }
          );

          // Decrement product quantity
          const newQuantity = product.quantity - orderProduct.count;
          if (newQuantity < 0) {
            product.quantity = 0;
          } else {
            product.quantity = newQuantity;
          }
          await product.save({ transaction });

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
          notes: notes ?? "",
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
          subTotal: ((await this.subTotal(order)) / 100).toFixed(2),
          shippingCost: (order.shippingCost / 100).toFixed(2),
          tax: (
            Math.floor((await this.subTotal(order)) * order.taxRate) / 100
          ).toFixed(2),
          totalCost: ((await this.totalCost(order)) / 100).toFixed(2),
        };

        await sendEmail(ADMIN_NEW_ORDER, emailVariables);
        await sendEmail(CUSTOMER_NEW_ORDER, emailVariables, me.email);
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
    @Arg("trackingNumber", { nullable: true }) trackingNumber?: string,
    @Arg("notes", { nullable: true }) notes?: string
  ): Promise<Order> {
    const order = await Order.findOne({
      where: { id },
      include: [
        { model: User },
        { model: Address },
        {
          model: OrderProduct,
          include: [{ model: Product, include: [ProductImage] }],
        },
      ],
    });
    if (!order) throw new Error("Invalid id");

    let shouldSendShippedEmail = false;
    if (
      (!order.shippedOn || !order.trackingNumber) &&
      trackingNumber &&
      shippedOn
    ) {
      shouldSendShippedEmail = true;
    }

    if (shippedOn !== undefined) order.shippedOn = shippedOn;
    if (completedOn !== undefined) order.completedOn = completedOn;
    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
    if (notes !== undefined) order.notes = notes;

    await order.save();

    if (shouldSendShippedEmail) {
      const emailVariables = {
        shippedDate: new Date(
          new Date(shippedOn as Date).setMinutes(
            (shippedOn as Date).getTimezoneOffset()
          )
        ).toLocaleDateString(), // new Date(shippedOn as Date).toLocaleDateString(),
        trackingNumber: trackingNumber as string,
        orderId: order.id,
        address: addressToString(order.address),
        notes: notes ?? "",
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
        subTotal: ((await this.subTotal(order)) / 100).toFixed(2),
        shippingCost: (order.shippingCost / 100).toFixed(2),
        tax: (
          Math.floor((await this.subTotal(order)) * order.taxRate) / 100
        ).toFixed(2),
        totalCost: ((await this.totalCost(order)) / 100).toFixed(2),
      };

      await sendEmail(ORDER_HAS_SHIPPED, emailVariables, order.user.email);
    }

    return order;
  }

  // TODO: Possibly move this
  @Mutation(() => Boolean)
  async sendMessage(
    @Arg("email") email: string,
    @Arg("message") message: string
  ): Promise<boolean> {
    return !!(await sendEmail(CONTACT_MESSAGE, { email, message }));
  }
}
