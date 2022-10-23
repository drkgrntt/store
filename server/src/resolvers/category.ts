import { Category, ProductCategory } from "../models";
import { Arg, Mutation, Query, Resolver, UseMiddleware } from "type-graphql";
import { isAdmin } from "../middleware/isAdmin";
import { Op } from "sequelize";

@Resolver(Category)
export class CategoryResolver {
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

  @Mutation(() => ProductCategory)
  @UseMiddleware(isAdmin)
  async attachCategory(
    @Arg("productId") productId: string,
    @Arg("categoryId") categoryId: string
  ): Promise<ProductCategory> {
    const record = await ProductCategory.create({ productId, categoryId });
    return record;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAdmin)
  async detachImage(@Arg("id") id: string): Promise<boolean> {
    const quantity = await ProductCategory.destroy({ where: { id } });
    return quantity > 0;
  }
}
