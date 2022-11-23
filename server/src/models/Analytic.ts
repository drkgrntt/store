import {
  Column,
  DataType,
  Default,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from "sequelize-typescript";

@Table({
  timestamps: true,
  underscored: true,
})
export class Analytic extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @Column
  ip: string;

  @Column
  useragent: string;

  @Column
  page: string;

  @Column
  modal: string;

  @IsUUID(4)
  @Column
  modalId: string;

  @Column
  token: string;

  @IsUUID(4)
  @Column
  userId: string;

  @Column(DataType.JSONB)
  query: Record<string, string | string[]>;
}
