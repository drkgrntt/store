import {
  Table,
  Model,
  Column,
  IsUUID,
  PrimaryKey,
  Default,
  DataType,
  BelongsTo,
  ForeignKey,
  AllowNull,
} from "sequelize-typescript";
import { Field, ObjectType } from "type-graphql";
import { Content, Category } from ".";

@ObjectType()
@Table({
  timestamps: true,
  underscored: true,
})
export class ContentCategory extends Model {
  @Field()
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @Field()
  @IsUUID(4)
  @ForeignKey(() => Category)
  @AllowNull(false)
  @Column
  categoryId: string;

  @BelongsTo(() => Category)
  category: Category;

  @Field()
  @IsUUID(4)
  @ForeignKey(() => Content)
  @AllowNull(false)
  @Column
  contentId: string;

  @BelongsTo(() => Content)
  content: Content;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
