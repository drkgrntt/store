import {
  Table,
  Model,
  Column,
  IsUUID,
  PrimaryKey,
  Default,
  DataType,
  HasMany,
  BelongsToMany,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Unique,
} from "sequelize-typescript";
import { Field, ObjectType } from "type-graphql";
import { Address } from "./Address";
import { OrderProduct } from "./OrderProduct";
import { Product } from "./Product";
import { User } from "./User";

@ObjectType()
@Table({
  timestamps: true,
  underscored: true,
})
export class Order extends Model {
  @Field()
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @HasMany(() => OrderProduct, {
    onDelete: "CASCADE",
  })
  orderedProducts: OrderProduct[];

  @BelongsToMany(() => Product, {
    through: { model: () => OrderProduct, unique: false },
  })
  products: Product[];

  @Field()
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: string;

  @BelongsTo(() => User)
  user: User;

  @Field()
  @ForeignKey(() => Address)
  @Column
  addressId: string;

  @BelongsTo(() => Address)
  address: Address;

  @Field({ nullable: true })
  @Column
  shippedOn: Date;

  @Field({ nullable: true })
  @Column
  completedOn: Date;

  @Field({ nullable: true })
  @Column
  trackingNumber: string;

  @Field()
  @Unique
  @Column
  paymentIntentId: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
