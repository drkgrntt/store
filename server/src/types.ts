import { Request, Response } from "express";
import { Sequelize } from "sequelize-typescript";
import {
  createImageIdsByProductLoader,
  createImageLoader,
} from "./dataloaders";
import { User } from "./models";

export interface Context {
  req: Request;
  res: Response;
  me: User;
  token: string;
  sequelize: Sequelize;
  imageLoader: ReturnType<typeof createImageLoader>;
  imageIdsByProductLoader: ReturnType<typeof createImageIdsByProductLoader>;
}

export interface Paginated<T> {
  hasMore: boolean;
  nextPage?: number;
  edges: T[];
}
