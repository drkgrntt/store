import { Product, UserProduct } from "../models";
import {
  Arg,
  Ctx,
  FieldResolver,
  Mutation,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { isAuth } from "../middleware/isAuth";
import { Context } from "../types";

@Resolver(UserProduct)
export class CartResolver {
  @FieldResolver(() => Product)
  async product(
    @Root() userProduct: UserProduct,
    @Ctx() { productLoader }: Context
  ): Promise<Product> {
    const product = await productLoader.load(userProduct.productId);
    if (!product) throw new Error("User product needs a product associated.");
    return product;
  }

  @Mutation(() => [UserProduct])
  @UseMiddleware(isAuth)
  async addToCart(
    @Ctx() { me }: Context,
    @Arg("productId") productId: string
  ): Promise<UserProduct[]> {
    const cartItem = await UserProduct.findOne({
      where: { userId: me.id, productId },
      include: { model: Product },
    });
    if (cartItem) {
      if (
        cartItem.product.quantity <= cartItem.count &&
        !cartItem.product.isMadeToOrder
      ) {
        throw new Error(
          "You cannot add more than what is available unless it can be made to order."
        );
      }

      cartItem.count++;
      await cartItem.save();
    } else {
      await UserProduct.create({
        userId: me.id,
        productId,
      });
    }

    const cart = await UserProduct.findAll({
      include: { model: Product },
      where: { userId: me.id },
    });
    return cart;
  }

  @Mutation(() => [UserProduct])
  @UseMiddleware(isAuth)
  async removeFromCart(
    @Ctx() { me }: Context,
    @Arg("productId") productId: string
  ): Promise<UserProduct[]> {
    const cartItem = await UserProduct.findOne({
      where: { userId: me.id, productId },
    });
    if (cartItem) {
      if (cartItem.count === 1) {
        await cartItem.destroy();
      } else {
        cartItem.count--;
        await cartItem.save();
      }
    }

    const cart = await UserProduct.findAll({
      include: { model: Product },
      where: { userId: me.id },
    });
    return cart;
  }
}
