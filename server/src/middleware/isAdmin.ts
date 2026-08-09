import { MiddlewareFn } from "type-graphql";
import { Context } from "../types";
import { isAuth } from "./isAuth";

export const isAdmin: MiddlewareFn<Context> = (resolverData, next) => {
  isAuth(resolverData, async () => {});

  if (!resolverData.context.me.isAdmin) {
    throw new Error("Not allowed");
  }

  return next();
};
