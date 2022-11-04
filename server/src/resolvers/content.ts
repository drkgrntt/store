import { Category, Content, ContentCategory } from "../models";
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
import { Op, WhereOptions } from "sequelize";

@Resolver(Content)
export class ContentResolver {
  @FieldResolver(() => [Category])
  async categories(@Root() content: Content): Promise<Category[]> {
    if (content.categories?.length) return content.categories;
    const records = await ContentCategory.findAll({
      where: { contentId: content.id },
      include: Category,
    });
    return records.map((cc) => cc.category);
  }

  @Query(() => [Content])
  async contents(
    @Arg("search", { nullable: true }) search?: string
  ): Promise<Content[]> {
    const where: WhereOptions = {};

    if (search) {
      const categories = await Category.findAll({
        attributes: ["id"],
        where: { name: { [Op.iLike]: `%${search}%` } },
        include: { model: Content, attributes: ["id"] },
      });

      where.ids = categories.reduce<string[]>(
        (ids, category) => [
          ...new Set([...ids, ...category.contents.map(({ id }) => id)]),
        ],
        []
      );
    }

    const content = await Content.findAll({
      where,
    });

    return content;
  }

  @Query(() => Content, { nullable: true })
  async content(@Arg("id") id: string): Promise<Content> {
    const content = await Content.findOne({ where: { id } });
    if (!content) throw new Error("Invalid id");
    return content;
  }

  @Mutation(() => Content)
  @UseMiddleware(isAdmin)
  async createContent(
    @Arg("detail") detail: string,
    @Arg("title", { nullable: true }) title?: string
  ): Promise<Content> {
    const content = await Content.create({
      title,
      detail,
    });

    return content;
  }

  @Mutation(() => Content)
  @UseMiddleware(isAdmin)
  async updateContent(
    @Arg("id") id: string,
    @Arg("title", { nullable: true }) title?: string,
    @Arg("detail", { nullable: true }) detail?: string
  ): Promise<Content> {
    const content = await Content.findOne({ where: { id } });
    if (!content) throw new Error("Invalid id");

    if (title !== undefined) content.title = title;
    if (detail !== undefined) content.detail = detail;

    await content.save();

    return content;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAdmin)
  async deleteContent(@Arg("id") id: string): Promise<boolean> {
    const quantity = await Content.destroy({ where: { id } });
    return quantity > 0;
  }
}
