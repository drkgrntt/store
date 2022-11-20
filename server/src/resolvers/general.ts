import { Context } from "../types";
import { Arg, Ctx, Mutation, Resolver } from "type-graphql";
import url from "url";
import { Analytic } from "../models";

@Resolver()
export class GeneralResolver {
  @Mutation(() => String)
  ping(@Ctx() { req, me, token }: Context, @Arg("path") path: string): "pong" {
    const data = url.parse(`${req.headers.origin}${path}`);
    const query = new URLSearchParams(data.search as string);

    console.log({ headers: req.headers, socket: req.socket });

    Analytic.create({
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      useragent: req.headers["user-agent"],
      page: data.pathname,
      modal: query.get("modal"),
      modalId: query.get("id"),
      token,
      userId: me?.id,
    });

    return "pong";
  }
}
