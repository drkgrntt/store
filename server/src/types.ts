import { Request, Response } from "express";
import { Sequelize } from "sequelize-typescript";
import { User } from "./models";

export interface Context {
  req: Request;
  res: Response;
  me: User;
  token: string;
  sequelize: Sequelize;
}

export interface Paginated<T> {
  hasMore: boolean;
  nextPage?: number;
  edges: T[];
}
