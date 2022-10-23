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
import { Product } from "./Product";
import { ProductCategory } from "./ProductCategory";

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

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
