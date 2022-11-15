import { Category, Product, ProductCategory, ProductImage } from "../models";
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
import { isAdmin } from "../middleware/isAdmin";
import { Context, Paginated } from "../types";
import { Op, WhereOptions } from "sequelize";
// import fs from "fs/promises";
// import path from "path";

@ObjectType()
class ProductPage implements Paginated<Product> {
  @Field()
  hasMore: boolean;

  @Field({ nullable: true })
  nextPage?: number;

  @Field(() => [Product])
  edges: Product[];
}

@Resolver(Product)
export class ProductResolver {
  @FieldResolver(() => [Category])
  async categories(@Root() product: Product): Promise<Category[]> {
    if (product.categories?.length) return product.categories;
    const records = await ProductCategory.findAll({
      where: { productId: product.id },
      include: Category,
    });
    return records.map((pc) => pc.category);
  }

  @FieldResolver(() => [ProductImage])
  async images(
    @Root() product: Product,
    @Ctx() { imageLoader, imageIdsByProductLoader }: Context
  ): Promise<ProductImage[]> {
    const imageIds = await imageIdsByProductLoader.load(product.id);
    const images = (await imageLoader.loadMany(
      imageIds || []
    )) as ProductImage[];

    return images;
  }

  @Query(() => ProductPage)
  async products(
    @Ctx() { me, productLoader }: Context,
    @Arg("active", { nullable: true }) active?: boolean,
    @Arg("page", { nullable: true }) page: number = 0,
    @Arg("perPage", { nullable: true }) perPage: number = 20,
    @Arg("search", { nullable: true }) search?: string
  ): Promise<ProductPage> {
    const where: WhereOptions = {
      isActive: true,
      [Op.or]: [{ isMadeToOrder: true }, { quantity: { [Op.gt]: 0 } }],
    };
    if (me?.isAdmin) {
      if (active === undefined) {
        delete where.isActive;
      } else {
        where.isActive = active;
      }
    }

    if (search) {
      const categories = await Category.findAll({
        attributes: ["id"],
        where: { name: { [Op.iLike]: `%${search}%` } },
        include: { model: Product, attributes: ["id"] },
      });

      const ids = categories.reduce<string[]>(
        (ids, category) => [
          ...new Set([...ids, ...category.products.map(({ id }) => id)]),
        ],
        []
      );

      where[Op.and as unknown as string] = {
        [Op.or]: [
          { title: { [Op.iLike]: `%${search}%` } },
          { id: ids },
          { description: { [Op.iLike]: `%${search}%` } },
        ],
      };
    }

    const featuredProductIds = (
      await Product.findAll({
        attributes: ["id"],
        where,
        include: {
          model: Category,
          where: { name: "Feature" },
        },
      })
    ).map(({ id }) => id);
    const numFeatured = featuredProductIds.length;

    const limit = perPage + 1;
    const offset = page * perPage;
    let found: Product[] = [];

    // Get featured
    if (numFeatured > offset + limit) {
      found = await Product.findAll({
        where: { ...where, id: featuredProductIds },
        limit,
        offset,
        order: [["createdAt", "desc"]],
      });
    }
    // Get non-featured
    else if (numFeatured < offset) {
      found = await Product.findAll({
        where: { ...where, id: { [Op.not]: featuredProductIds } },
        limit,
        offset: offset - numFeatured,
        order: [["createdAt", "desc"]],
      });
    }
    // Merge at the seam
    else {
      const featured = await Product.findAll({
        where: { ...where, id: featuredProductIds },
        limit,
        offset,
        order: [["createdAt", "desc"]],
      });
      const nonFeatured = await Product.findAll({
        where: { ...where, id: { [Op.not]: featuredProductIds } },
        limit: limit - featured.length,
        offset: 0,
        order: [["createdAt", "desc"]],
      });
      found = [...featured, ...nonFeatured];
    }

    // const sql = (
    //   await fs.readFile(path.join("sql", "products.sql"))
    // ).toString();
    // const found = await sequelize.query(sql, {
    //   model: Product,
    //   mapToModel: true,
    //   replacements: [(perPage + 1).toString(), (page * perPage).toString()],
    // });

    found.forEach((product) => productLoader.prime(product.id, product));

    const products = found.slice(0, perPage);
    const hasMore = found.length > perPage;

    return {
      edges: products,
      hasMore,
      nextPage: hasMore ? page + 1 : undefined,
    };
  }

  @Query(() => Product, { nullable: true })
  async product(
    @Ctx() { me }: Context,
    @Arg("id") id: string,
    @Arg("active", { nullable: true }) active?: boolean
  ): Promise<Product> {
    const where: { isActive?: boolean; id: string } = { isActive: true, id };
    if (me?.isAdmin) {
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
