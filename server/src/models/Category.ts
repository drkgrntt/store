import {
  BelongsToMany,
  Column,
  DataType,
  Default,
  HasMany,
  IsUUID,
  Model,
  AllowNull,
  PrimaryKey,
  Table,
} from "sequelize-typescript";
import { Field, ObjectType } from "type-graphql";
import { Content, ContentCategory, Product, ProductCategory } from ".";

@ObjectType()
@Table({
  timestamps: true,
  underscored: true,
})
export class Category extends Model {
  @Field()
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @Field()
  @AllowNull(false)
  @Column
  name: string;

  @HasMany(() => ProductCategory, {
    onDelete: "CASCADE",
  })
  productCategories: ProductCategory[];

  @BelongsToMany(() => Product, {
    through: { model: () => ProductCategory, unique: false },
  })
  products: Product[];

  @HasMany(() => ContentCategory, {
    onDelete: "CASCADE",
  })
  contentCategories: ContentCategory[];

  @BelongsToMany(() => Content, {
    through: { model: () => ContentCategory, unique: false },
  })
  contents: Product[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
