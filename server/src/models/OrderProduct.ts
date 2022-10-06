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
  Is,
  BeforeCreate,
} from "sequelize-typescript";
import { Field, ObjectType } from "type-graphql";
import { Product } from "./Product";
import { Order } from "./Order";
import { Transaction } from "sequelize/types";

@ObjectType()
@Table({
  timestamps: true,
  underscored: true,
})
export class OrderProduct extends Model {
  @Field()
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => Order)
  @AllowNull(false)
  @Column
  orderId: string;

  @BelongsTo(() => Order)
  order: Order;

  @IsUUID(4)
  @ForeignKey(() => Product)
  @AllowNull(false)
  @Column
  productId: string;

  @BelongsTo(() => Product)
  product: Product;

  @Field()
  @Default(1)
  @Is("Positive", (value) => {
    if (value <= 0) {
      throw new Error(`"${value}" must be greater than 0.`);
    }
  })
  @AllowNull(false)
  @Column
  count: number;

  @Field()
  @Is("Positive", (value) => {
    if (value < 0) {
      throw new Error(`"${value}" must be positive.`);
    }
  })
  @Column
  price: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @BeforeCreate
  static async canOrderQuantity(
    instance: OrderProduct,
    { transaction }: { transaction: Transaction }
  ) {
    const product = await Product.findOne({
      where: { id: instance.productId },
      transaction,
    });

    if (!product?.isActive) {
      throw new Error("This product is inactive.");
    }

    if (product?.isMadeToOrder && product.quantity < instance.count) {
      throw new Error(
        "You cannot order more than what is available unless it can be made to order."
      );
    }
  }
}
