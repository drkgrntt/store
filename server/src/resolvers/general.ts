import { Context } from "../types";
import { Arg, Ctx, Mutation, Resolver } from "type-graphql";
import url from "url";
import { Analytic } from "../models";

@Resolver()
export class GeneralResolver {
  @Mutation(() => String)
  ping(@Ctx() { req, me, token }: Context, @Arg("path") path: string): "pong" {
    const useragent = req.headers["user-agent"];
    if (
      useragent?.includes(
        "(compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
      )
    ) {
      return "pong";
    }

    const data = url.parse(`${req.headers.origin}${path}`);
    const query = new URLSearchParams(data.search as string);

    // TODO: IP is not working properly
    // https://www.digitalocean.com/community/questions/server-receiving-hit-from-this-ip-address-ffff-127-0-0-1-why-is-that-and-how-to-resolve-this
    Analytic.create({
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      useragent,
      page: data.pathname,
      modal: query.get("modal"),
      modalId: query.get("id"),
      token,
      userId: me?.id,
    });

    return "pong";
  }
}
