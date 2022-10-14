import { Product, ProductImage } from "../models";
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
import { isAdmin } from "../middleware/isAdmin";
import { Context } from "../types";

@Resolver(Product)
export class ProductResolver {
  @FieldResolver(() => [ProductImage])
  async images(@Root() product: Product): Promise<ProductImage[]> {
    if (product.images?.length) return product.images;
    const images = await ProductImage.findAll({
      where: { productId: product.id },
    });
    return images;
  }

  @Query(() => [Product])
  async products(
    @Ctx() { me }: Context,
    @Arg("active", { nullable: true }) active?: boolean
  ): Promise<Product[]> {
    const where: { isActive?: boolean } = { isActive: true };
    if (me.isAdmin) {
      if (active === undefined) {
        delete where.isActive;
      } else {
        where.isActive = active;
      }
    }
    const products = await Product.findAll({ where });
    return products;
  }

  @Query(() => Product, { nullable: true })
  async product(
    @Ctx() { me }: Context,
    @Arg("id") id: string,
    @Arg("active", { nullable: true }) active?: boolean
  ): Promise<Product> {
    const where: { isActive?: boolean; id: string } = { isActive: true, id };
    if (me.isAdmin) {
      if (active === undefined) {
        delete where.isActive;
      } else {
        where.isActive = active;
      }
    }
    const product = await Product.findOne({ where });
    if (!product) throw new Error("Invalid id");
    return product;
  }

  @Mutation(() => Product)
  @UseMiddleware(isAdmin)
  async createProduct(
    @Arg("title") title: string,
    @Arg("description") description: string,
    @Arg("price") price: number,
    @Arg("quantity") quantity: number,
    @Arg("isMadeToOrder") isMadeToOrder: boolean,
    @Arg("isActive") isActive: boolean
  ): Promise<Product> {
    const product = await Product.create({
      title,
      description,
      price,
      quantity,
      isMadeToOrder,
      isActive,
    });

    return product;
  }

  @Mutation(() => Product)
  @UseMiddleware(isAdmin)
  async updateProduct(
    @Arg("id") id: string,
    @Arg("title", { nullable: true }) title?: string,
    @Arg("description", { nullable: true }) description?: string,
    @Arg("price", { nullable: true }) price?: number,
    @Arg("quantity", { nullable: true }) quantity?: number,
    @Arg("isMadeToOrder", { nullable: true }) isMadeToOrder?: boolean,
    @Arg("isActive", { nullable: true }) isActive?: boolean
  ): Promise<Product> {
    const product = await Product.findOne({ where: { id } });
    if (!product) throw new Error("Invalid id");

    if (title !== undefined) product.title = title;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (quantity !== undefined) product.quantity = quantity;
    if (isMadeToOrder !== undefined) product.isMadeToOrder = isMadeToOrder;
    if (isActive !== undefined) product.isActive = isActive;

    await product.save();

    return product;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAdmin)
  async deleteProduct(@Arg("id") id: string): Promise<boolean> {
    const quantity = await Product.destroy({ where: { id } });
    return quantity > 0;
  }
}
