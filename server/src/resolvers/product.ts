import { Category, Product, ProductImage } from "../models";
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
import { Literal } from "sequelize/types/utils";
import { toCamelCase } from "../utils";
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
  async categories(
    @Root() product: Product,
    @Ctx() { categoryLoader, categoryIdsByProductLoader }: Context
  ): Promise<Category[]> {
    const categoryIds = await categoryIdsByProductLoader.load(product.id);
    const categories = (await categoryLoader.loadMany(
      categoryIds || []
    )) as Category[];
    return categories;
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
    @Ctx() { me, productLoader, sequelize }: Context,
    @Arg("page", { nullable: true }) page: number = 0,
    @Arg("perPage", { nullable: true }) perPage: number = 20,
    @Arg("active", { nullable: true }) active?: boolean,
    @Arg("search", { nullable: true }) search?: string,
    @Arg("tagSearch", { nullable: true }) tagSearch?: boolean
  ): Promise<ProductPage> {
    let where: WhereOptions = {
      isActive: true,
      [Op.or]: [{ isMadeToOrder: true }, { quantity: { [Op.gt]: 0 } }],
    };

    if (me?.isAdmin) {
      if (active === undefined) {
        where = {};
      } else {
        where.isActive = active;
      }
    }

    if (search) {
      const searchItems = search.split(" ");

      const categories = await Category.findAll({
        attributes: ["id"],
        where: {
          [Op.or]: searchItems.map((item) => ({
            name: { [Op.iLike]: `%${item}%` },
          })),
        },
        include: { model: Product, attributes: ["id"] },
      });

      const ids = categories.reduce<string[]>(
        (ids, category) => [
          ...new Set([...ids, ...category.products.map(({ id }) => id)]),
        ],
        []
      );

      const orParams: WhereOptions = [{ id: ids }];
      if (!tagSearch) {
        searchItems.forEach((item) => {
          orParams.push({
            [Op.or]: [
              { title: { [Op.iLike]: `%${item}%` } },
              { description: { [Op.iLike]: `%${item}%` } },
            ],
          });
        });
      }

      where[Op.and as unknown as string] = {
        [Op.or]: orParams,
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

    const viewCountAttribute: [Literal, string] = [
      sequelize.literal(
        `(SELECT COUNT(*) FROM analytics WHERE analytics.modal = 'detail' AND analytics.modal_id = "Product".id)`
      ),
      "view_count",
    ];
    const viewCountOrder: [Literal, string] = [
      sequelize.literal("view_count"),
      "DESC",
    ];
    const productKeys = Object.keys(await Product.describe()).map(toCamelCase);

    // Get featured
    if (numFeatured > offset + limit) {
      found = await Product.findAll({
        attributes: [...productKeys, viewCountAttribute],
        where: { ...where, id: featuredProductIds },
        limit,
        offset,
        order: [viewCountOrder, ["createdAt", "desc"]],
      });
    }
    // Get non-featured
    else if (numFeatured < offset) {
      found = await Product.findAll({
        attributes: [...productKeys, viewCountAttribute],
        where: { ...where, id: { [Op.not]: featuredProductIds } },
        limit,
        offset: offset - numFeatured,
        order: [viewCountOrder, ["createdAt", "desc"]],
      });
    }
    // Merge at the seam
    else {
      const featured = await Product.findAll({
        attributes: [...productKeys, viewCountAttribute],
        where: { ...where, id: featuredProductIds },
        limit,
        offset,
        order: [viewCountOrder, ["createdAt", "desc"]],
      });
      const nonFeatured = await Product.findAll({
        attributes: [...productKeys, viewCountAttribute],
        where: { ...where, id: { [Op.not]: featuredProductIds } },
        limit: limit - featured.length,
        offset: 0,
        order: [viewCountOrder, ["createdAt", "desc"]],
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
