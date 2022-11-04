import {
  AfterCreate,
  AfterFind,
  BeforeCreate,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Index,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from "sequelize-typescript";
import { ObjectType, Field } from "type-graphql";
import jwt from "jsonwebtoken";
import { User } from ".";
import { Transaction } from "sequelize/types";

@ObjectType()
@Table({
  timestamps: true,
  underscored: true,
})
export class Token extends Model {
  @Field()
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @Field()
  @Unique
  @Column
  value: string;

  @BeforeCreate
  static removeSignature(instance: Token) {
    instance.value = Token.unsign(instance.value);
  }

  @AfterFind
  static async addSignatures(
    instances: Token[],
    { transaction }: { transaction: Transaction }
  ) {
    if (!Array.isArray(instances)) {
      instances = [instances];
    }
    for (const instance of instances) {
      await Token.addSignature(instance, { transaction });
    }
  }

  @AfterCreate
  static async addSignature(
    instance: Token,
    { transaction }: { transaction: Transaction }
  ) {
    const value = Token.sign(instance?.value);
    if (!value) {
      await instance?.destroy({ transaction });
    } else {
      instance.value = value;
    }
  }

  @Index
  @Column
  expiry: Date;

  @Column
  issued: Date;

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

  static sign(value: string): string {
    const decoded = jwt.decode(`${value}.x`);
    if (!decoded) return "";
    const signed = jwt.sign(decoded, process.env.JWT_SECRET);
    return signed;
  }

  static unsign(value: string): string {
    const [header, data] = value.split(".");
    const unsigned = `${header}.${data}`;
    return unsigned;
  }

  static async verifyAndFindUser(value: string): Promise<User | null> {
    if (!value) return null;
    const unsigned = Token.unsign(value);
    const token = await Token.findOne({
      where: { value: unsigned },
      include: [User],
    });
    if (!token) return null;
    try {
      jwt.verify(value, process.env.JWT_SECRET);
      return token.user;
    } catch (err) {
      await token.destroy();
      return null;
    }
  }

  static async generate(
    uid: string,
    transaction?: Transaction,
    daysValid: number = 30
  ): Promise<Token> {
    const now = new Date();
    const expiry = new Date(new Date(now).setDate(now.getDate() + daysValid));
    const value = jwt.sign(
      {
        uid: uid,
        iat: Math.floor(now.getTime() / 1000),
        exp: Math.floor(expiry.getTime() / 1000),
      },
      process.env.JWT_SECRET
    );

    const token = await Token.create(
      {
        value,
        expiry,
        issued: now,
        userId: uid,
      },
      { transaction }
    );

    return token;
  }
}
