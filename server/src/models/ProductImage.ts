import {
  AfterSave,
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  Not,
} from "sequelize-typescript";
import { Transaction } from "sequelize/types";
import { Field, ObjectType } from "type-graphql";
import { Product } from ".";

@ObjectType()
@Table({
  timestamps: true,
  underscored: true,
})
export class ProductImage extends Model {
  @Field()
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @Field()
  @AllowNull(false)
  @Column
  url: string;

  @Field({ nullable: true })
  @Column
  title: string;

  @Field({ nullable: true })
  @Column
  description: string;

  @Field()
  @AllowNull(false)
  @Default(false)
  @Column
  primary: boolean;

  @AfterSave
  static async ensurePrimary(
    instance: ProductImage,
    { transaction }: { transaction: Transaction }
  ) {
    if (instance.primary) {
      await ProductImage.update(
        { primary: false },
        {
          where: { productId: instance.productId, id: Not(instance.id) },
          transaction,
        }
      );
    } else {
      const quantity = await ProductImage.count({
        where: { primary: true },
        transaction,
      });
      if (!quantity) {
        throw new Error("One image must be primary.");
      }
    }
  }

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
