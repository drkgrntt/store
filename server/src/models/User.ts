import {
  Table,
  Model,
  Column,
  IsUUID,
  PrimaryKey,
  Is,
  Default,
  DataType,
  Unique,
  HasMany,
  BelongsToMany,
  AllowNull,
  HasOne,
} from "sequelize-typescript";
import { Field, ObjectType } from "type-graphql";
import { Address } from "./Address";
import { Order } from "./Order";
import { Product } from "./Product";
import { Token } from "./Token";
import { UserProduct } from "./UserProduct";

const EMAIL_REGEX =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

@ObjectType()
@Table({
  timestamps: true,
  underscored: true,
})
export class User extends Model {
  @Field()
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @Field()
  @Unique
  @Is("EmailAddress", (value) => {
    if (!EMAIL_REGEX.test(value)) {
      throw new Error(`"${value}" is not a valid email address.`);
    }
  })
  @Column
  email: string;

  @Column
  password: string;

  @Field({ nullable: false })
  @AllowNull(false)
  @Default(false)
  @Column
  isAdmin: boolean;

  @HasMany(() => Token, {
    onDelete: "CASCADE",
  })
  tokens: Token[];

  @HasMany(() => Order, {
    onDelete: "CASCADE",
  })
  orders: Order[];

  @HasMany(() => Address, {
    onDelete: "CASCADE",
  })
  addresses: Address[];

  @HasOne(() => Address, {
    onDelete: "CASCADE",
  })
  billingAddress: Address;

  @HasMany(() => Address, {
    onDelete: "CASCADE",
  })
  shippingAddresses: Address[];

  @HasMany(() => UserProduct, {
    onDelete: "CASCADE",
  })
  cart: UserProduct[];

  @BelongsToMany(() => Product, {
    through: { model: () => UserProduct, unique: false },
  })
  products: Product[];

  // @Column
  // birthday: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
