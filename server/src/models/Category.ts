import {
  BelongsToMany,
  Column,
  DataType,
  Default,
  HasMany,
  IsUUID,
  Model,
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
