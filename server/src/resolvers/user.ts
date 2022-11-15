import { Address, Order, Product, Token, User, UserProduct } from "../models";
import bcrypt from "bcrypt";
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
import { AddressType } from "../models/Address";
import { FORGOT_PASSWORD, sendEmail } from "../utils/email";
import { Op } from "sequelize";

@Resolver(UserProduct)
export class UserProductResolver {
  @FieldResolver(() => Product)
  async product(
    @Root() userProduct: UserProduct,
    @Ctx() { productLoader }: Context
  ): Promise<Product> {
    const product = await productLoader.load(userProduct.productId);
    if (!product) throw new Error("User product needs a product associated.");
    return product;
  }
}

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => [Token])
  async tokens(@Root() user: User): Promise<Token[]> {
    if (user.tokens?.length) return user.tokens;
    const tokens = await Token.findAll({ where: { userId: user.id } });
    return tokens;
  }

  @FieldResolver(() => [Address])
  async addresses(
    @Root() user: User,
    @Ctx() { addressIdsByUserLoader, addressLoader }: Context
  ): Promise<Address[]> {
    const addressIds = await addressIdsByUserLoader.load(user.id);
    const addresses = (await addressLoader.loadMany(
      addressIds || []
    )) as Address[];

    return addresses;
  }

  @FieldResolver(() => Address, { nullable: true })
  async billingAddress(
    @Root() user: User,
    @Ctx() { addressIdsByUserLoader, addressLoader }: Context
  ): Promise<Address | undefined> {
    const addressIds = await addressIdsByUserLoader.load(user.id);
    const addresses = (await addressLoader.loadMany(
      addressIds || []
    )) as Address[];

    return addresses.find((a) => a.type === AddressType.BILLING);
  }

  @FieldResolver(() => [Address])
  async shippingAddresses(
    @Root() user: User,
    @Ctx() { addressIdsByUserLoader, addressLoader }: Context
  ): Promise<Address[]> {
    const addressIds = await addressIdsByUserLoader.load(user.id);
    const addresses = (await addressLoader.loadMany(
      addressIds || []
    )) as Address[];

    return addresses.filter((a) => a.type === AddressType.SHIPPING);
  }

  @FieldResolver(() => [Order])
  async orders(
    @Root() user: User,
    @Ctx() { orderIdsByUserLoader, orderLoader }: Context
  ): Promise<Order[]> {
    const orderIds = await orderIdsByUserLoader.load(user.id);
    const orders = (await orderLoader.loadMany(orderIds || [])) as Order[];
    return orders.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }

  @FieldResolver(() => [UserProduct])
  async cart(
    @Root() user: User,
    @Ctx() { userProductIdsByUserLoader, userProductLoader }: Context
  ): Promise<UserProduct[]> {
    const userProductIds = await userProductIdsByUserLoader.load(user.id);
    const cart = (await userProductLoader.loadMany(
      userProductIds || []
    )) as UserProduct[];
    return cart;
  }

  @Query(() => String)
  ping(): "pong" {
    return "pong";
  }

  @Query(() => User, { nullable: true })
  me(@Ctx() { me }: any): User {
    return me;
  }

  @Mutation(() => User)
  async register(
    @Arg("password") password: string,
    @Arg("email") email: string,
    @Ctx() { res, sequelize }: Context
  ): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 13);

    const transaction = await sequelize.transaction();
    try {
      const user = await User.create(
        {
          email,
          password: passwordHash,
        },
        { transaction }
      );

      const token = await Token.generate(user.id, transaction);

      await transaction.commit();

      user.tokens = [token];

      res.setToken(token.value);

      return user;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  @Mutation(() => User)
  async login(
    @Arg("password") password: string,
    @Arg("email") email: string,
    @Ctx() { res, sequelize }: Context
  ): Promise<User> {
    const transaction = await sequelize.transaction();

    try {
      const user = await User.findOne({
        where: { email: { [Op.iLike]: email } },
        transaction,
      });
      if (!user) {
        throw new Error("Invalid email or password");
      }

      const correctPassword = await bcrypt.compare(password, user.password);
      if (!correctPassword) {
        throw new Error("Invalid email or password");
      }

      const token = await Token.generate(user.id, transaction);

      await transaction.commit();

      user.tokens = [token];

      res.setToken(token.value);
      return user;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async resetPassword(
    @Ctx() { me }: Context,
    @Arg("old") oldPassword: string,
    @Arg("new") newPassword: string
  ): Promise<boolean> {
    const correctPassword = await bcrypt.compare(oldPassword, me.password);
    if (!correctPassword) {
      throw new Error("Invalid old password");
    }

    const passwordHash = await bcrypt.hash(newPassword, 13);
    me.password = passwordHash;
    await me.save();

    return true;
  }

  @Mutation(() => Boolean)
  async forgotPassword(@Arg("email") email: string): Promise<boolean> {
    const user = await User.findOne({
      where: { email: { [Op.iLike]: email } },
    });
    if (!user) return true;

    const token = await Token.generate(user.id, undefined, 1);
    const link = `${process.env.APP_BASE_URL}/?modal=reset-forgotten-password&modal-params=token&token=${token.value}`;
    const variables = {
      email,
      actionButton: [
        {
          actionText: "Reset my password",
          actionLink: link,
        },
      ],
    };

    const result = await sendEmail(FORGOT_PASSWORD, variables, user.email);

    return !!result;
  }

  @Mutation(() => Boolean)
  async resetForgottenPassword(
    @Arg("email") email: string,
    @Arg("password") password: string,
    @Arg("token") token: string
  ): Promise<boolean> {
    const user = await Token.verifyAndFindUser(token);
    if (!user)
      throw new Error(
        "There is a problem with this link. Please try getting another link."
      );

    if (user.email.toLowerCase() !== email.toLowerCase()) {
      throw new Error(
        "This email does not match any in our system. Please try again."
      );
    }

    const passwordHash = await bcrypt.hash(password, 13);
    user.password = passwordHash;
    await user.save();

    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async logout(@Ctx() { token, res }: Context): Promise<boolean> {
    const value = Token.unsign(token);
    const result = await Token.destroy({ where: { value } });
    res.removeToken();
    return !!result;
  }

  @Mutation(() => Token)
  @UseMiddleware(isAuth)
  async logoutEverywhere(
    @Ctx() { me, res, sequelize }: Context
  ): Promise<Token> {
    const transaction = await sequelize.transaction();
    try {
      await Token.destroy({ where: { userId: me.id }, transaction });
      const token = await Token.generate(me.id, transaction);
      await transaction.commit();
      res.setToken(token.value);
      return token;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
