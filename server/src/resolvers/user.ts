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

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => [Token])
  async tokens(@Root() user: User): Promise<Token[]> {
    if (user.tokens?.length) return user.tokens;
    const tokens = await Token.findAll({ where: { userId: user.id } });
    return tokens;
  }

  @FieldResolver(() => [Address])
  async addresses(@Root() user: User): Promise<Address[]> {
    if (user.addresses?.length) return user.addresses;
    const addresses = await Address.findAll({ where: { userId: user.id } });
    return addresses;
  }

  @FieldResolver(() => Address, { nullable: true })
  async billingAddress(@Root() user: User): Promise<Address | null> {
    if (user.billingAddress) return user.billingAddress;
    const billingAddress = await Address.findOne({
      where: { userId: user.id, type: AddressType.BILLING },
    });
    return billingAddress;
  }

  @FieldResolver(() => [Address])
  async shippingAddresses(@Root() user: User): Promise<Address[]> {
    if (user.addresses?.length) return user.addresses;
    const addresses = await Address.findAll({
      where: { userId: user.id, type: AddressType.SHIPPING },
    });
    return addresses;
  }

  @FieldResolver(() => [Order])
  async orders(@Root() user: User): Promise<Order[]> {
    if (user.orders?.length) return user.orders;
    const orders = await Order.findAll({ where: { userId: user.id } });
    return orders;
  }

  @FieldResolver(() => [UserProduct])
  async cart(@Root() user: User): Promise<UserProduct[]> {
    if (user.cart) return user.cart;
    const cart = await UserProduct.findAll({
      where: { userId: user.id },
      include: { model: Product },
    });
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
          email: email.toLowerCase(),
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
        where: { email: email.toLowerCase() },
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
