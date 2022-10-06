import { MiddlewareFn } from "type-graphql";
import { Context } from "../types";

export const isAuth: MiddlewareFn<Context> = ({ context }, next) => {
  if (!context.me) {
    throw new Error("Not authenticated");
  }

  return next();
};
