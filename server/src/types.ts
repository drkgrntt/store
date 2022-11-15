import { Request, Response } from "express";
import { Sequelize } from "sequelize-typescript";
import {
  createAddressIdsByUserLoader,
  createAddressLoader,
  createOrderLoader,
  createProductLoader,
  createImageIdsByProductLoader,
  createImageLoader,
  createOrderIdsByUserLoader,
  createUserProductLoader,
  createUserProductIdsByUserLoader,
  createOrderProductLoader,
  createOrderProductIdsByOrderLoader,
} from "./dataloaders";
import { User } from "./models";

export interface Context {
  req: Request;
  res: Response;
  me: User;
  token: string;
  sequelize: Sequelize;
  productLoader: ReturnType<typeof createProductLoader>;
  orderLoader: ReturnType<typeof createOrderLoader>;
  orderIdsByUserLoader: ReturnType<typeof createOrderIdsByUserLoader>;
  addressLoader: ReturnType<typeof createAddressLoader>;
  addressIdsByUserLoader: ReturnType<typeof createAddressIdsByUserLoader>;
  userProductLoader: ReturnType<typeof createUserProductLoader>;
  userProductIdsByUserLoader: ReturnType<
    typeof createUserProductIdsByUserLoader
  >;
  orderProductLoader: ReturnType<typeof createOrderProductLoader>;
  orderProductIdsByOrderLoader: ReturnType<
    typeof createOrderProductIdsByOrderLoader
  >;
  imageLoader: ReturnType<typeof createImageLoader>;
  imageIdsByProductLoader: ReturnType<typeof createImageIdsByProductLoader>;
}

export interface Paginated<T> {
  hasMore: boolean;
  nextPage?: number;
  edges: T[];
}
