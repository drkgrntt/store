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
  Not,
  PrimaryKey,
  Table,
} from "sequelize-typescript";
import { ObjectType, Field } from "type-graphql";
import { User } from ".";
import { Transaction } from "sequelize/types";

export enum AddressType {
  BILLING = "billing",
  SHIPPING = "shipping",
}

@ObjectType()
@Table({
  timestamps: true,
  underscored: true,
})
export class Address extends Model {
  @Field()
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @Field()
  @AllowNull(false)
  @Column
  recipient: string;

  @Field()
  @AllowNull(false)
  @Column
  lineOne: string;

  @Field({ nullable: true })
  @Column
  lineTwo: string;

  @Field()
  @AllowNull(false)
  @Column
  city: string;

  @Field()
  @AllowNull(false)
  @Column
  state: string;

  @Field()
  @AllowNull(false)
  @Column
  zipCode: string;

  @Field()
  @AllowNull(false)
  @Default("United States")
  @Column
  country: string;

  @Field()
  @AllowNull(false)
  @Default(AddressType.SHIPPING)
  @Column
  type: AddressType;

  @AfterSave
  static async ensureOneBilling(
    instance: Address,
    { transaction }: { transaction: Transaction }
  ) {
    if (instance.type === AddressType.BILLING) {
      await Address.update(
        { type: AddressType.SHIPPING },
        {
          where: { userId: instance.userId, id: Not(instance.id) },
          transaction,
        }
      );
    }
  }

  @Field()
  @ForeignKey(() => User)
  @Column
  userId: string;

  @BelongsTo(() => User)
  user: User;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
