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

  @Field()
  @AllowNull(false)
  @Default(false)
  @Column
  isShipped: boolean;

  @Field()
  @AllowNull(false)
  @Default(false)
  @Column
  isComplete: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
