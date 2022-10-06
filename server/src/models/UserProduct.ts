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
} from "sequelize-typescript";
import { Field, ObjectType } from "type-graphql";
import { Product } from "./Product";
import { User } from "./User";

@ObjectType()
@Table({
  timestamps: true,
  underscored: true,
})
export class UserProduct extends Model {
  @Field()
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: string;

  @BelongsTo(() => User)
  user: User;

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
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
