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
} from "sequelize-typescript";
import { Field, ObjectType } from "type-graphql";
import { Category, ContentCategory } from ".";

@ObjectType()
@Table({
  timestamps: true,
  underscored: true,
})
export class Content extends Model {
  @Field()
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @Field({ nullable: true })
  @Column
  title: string;

  @Field()
  @Column(DataType.STRING(3000))
  detail: string;

  @HasMany(() => ContentCategory, {
    onDelete: "CASCADE",
  })
  contentCategories: ContentCategory[];

  @BelongsToMany(() => Category, {
    through: { model: () => ContentCategory, unique: false },
  })
  categories: Category[];
}
