import { Category, ContentCategory, Product, ProductCategory } from "../models";
import {
  Arg,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { isAdmin } from "../middleware/isAdmin";
import { Op } from "sequelize";

@Resolver(Category)
export class CategoryResolver {
  @FieldResolver(() => [Product])
  async products(@Root() category: Category): Promise<Product[]> {
    if (category.products?.length) return category.products;
    const records = await ProductCategory.findAll({
      where: { categoryId: category.id },
      include: Product,
    });
    return records.map((pc) => pc.product);
  }

  @Query(() => [Category])
  async categories(
    @Arg("search", { nullable: true }) search: string
  ): Promise<Category[]> {
    const categories = await Category.findAll({
      where: { name: { [Op.iLike]: `%${search}%` } },
    });
    return categories;
  }

  @Mutation(() => Category)
  @UseMiddleware(isAdmin)
  async createCategory(@Arg("name") name: string): Promise<Category> {
    const category = await Category.create({ name });
    return category;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAdmin)
  async attachCategory(
    @Arg("categoryId") categoryId: string,
    @Arg("productId", { nullable: true }) productId?: string,
    @Arg("contentId", { nullable: true }) contentId?: string
  ): Promise<boolean> {
    if (productId)
      return !!(await ProductCategory.create({ productId, categoryId }));

    if (contentId)
      return !!(await ContentCategory.create({ contentId, categoryId }));

    return false;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAdmin)
  async detachCategory(
    @Arg("categoryId") categoryId: string,
    @Arg("productId", { nullable: true }) productId?: string,
    @Arg("contentId", { nullable: true }) contentId?: string
  ): Promise<boolean> {
    let quantity = 0;
    if (productId) {
      quantity = await ProductCategory.destroy({
        where: { productId, categoryId },
      });
    } else if (contentId) {
      quantity = await ContentCategory.destroy({
        where: { contentId: categoryId },
      });
    }
    return quantity > 0;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAdmin)
  async clearFeatures() {
    const pcs = await ProductCategory.findAll({
      attributes: ["id"],
      include: { model: Category, where: { name: "Feature" } },
    });
    const quantity = await ProductCategory.destroy({
      where: { id: pcs.map((pc) => pc.id) },
    });
    return quantity > 0;
  }
}
