import {
  Table,
  Model,
  Column,
  IsUUID,
  PrimaryKey,
  Is,
  Default,
  DataType,
  HasMany,
  BelongsToMany,
} from "sequelize-typescript";
import { Field, ObjectType } from "type-graphql";
import { Order } from "./Order";
import { OrderProduct } from "./OrderProduct";
import { ProductImage } from "./ProductImage";
import { User } from "./User";
import { UserProduct } from "./UserProduct";

@ObjectType()
@Table({
  timestamps: true,
  underscored: true,
})
export class Product extends Model {
  @Field()
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @Field()
  @Column
  title: string;

  @Field()
  @Column
  description: string;

  @Field()
  @Is("Positive", (value) => {
    if (value < 0) {
      throw new Error(`"${value}" must be positive.`);
    }
  })
  @Column
  price: number;

  @Field()
  @Is("Positive", (value) => {
    if (value < 0) {
      throw new Error(`"${value}" must be positive.`);
    }
  })
  @Column
  quantity: number;

  @Field()
  @Column
  isMadeToOrder: boolean;

  @Field()
  @Column
  isActive: boolean;

  @HasMany(() => UserProduct, {
    onDelete: "CASCADE",
  })
  userProducts: UserProduct[];

  @BelongsToMany(() => Product, {
    through: { model: () => UserProduct, unique: false },
  })
  users: User[];

  @HasMany(() => OrderProduct, {
    onDelete: "CASCADE",
  })
  orderProducts: OrderProduct[];

  @BelongsToMany(() => Order, {
    through: { model: () => OrderProduct, unique: false },
  })
  orders: Order[];

  @HasMany(() => ProductImage, {
    onDelete: "CASCADE",
  })
  images: ProductImage[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
