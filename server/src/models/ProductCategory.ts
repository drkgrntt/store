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
import { Product } from "./Product";
import { Category } from "./Category";

@ObjectType()
@Table({
  timestamps: true,
  underscored: true,
})
export class ProductCategory extends Model {
  @Field()
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => Category)
  @AllowNull(false)
  @Column
  categoryId: string;

  @BelongsTo(() => Category)
  category: Category;

  @IsUUID(4)
  @ForeignKey(() => Product)
  @AllowNull(false)
  @Column
  productId: string;

  @BelongsTo(() => Product)
  product: Product;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
