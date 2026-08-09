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

    const useragent = req.headers["user-agent"];
    if (
      useragent?.includes(
        "(compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
      ) ||
      useragent?.includes("Vercelbot/0.1 (+https://vercel.com)")
    ) {
      console.count("bot ping");
      console.log({
        useragent,
        page: data.pathname,
        modal: query.get("modal"),
        date: new Date().toISOString(),
      });
      return "pong";
    }

    try {
      Analytic.create({
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        useragent,
        page: data.pathname,
        modal: query.get("modal"),
        modalId: query.get("id"),
        token,
        userId: me?.id,
        query: Object.fromEntries(query),
      });
    } catch (err) {
      console.error(err);
    }

    return "pong";
  }
}
