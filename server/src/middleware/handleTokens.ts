import { NextFunction, Request, Response } from "express";
import { __prod__ } from "../constants";

export const handleTokens = (_: Request, res: Response, next: NextFunction) => {
  res.setToken = (value: string) => {
    res.cookie("token", value, {
      sameSite: __prod__ ? "none" : "lax",
      secure: true,
      domain: __prod__ ? "midwestdaisy.com" : undefined,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
  };

  res.removeToken = () => {
    res.cookie("token", "a.b.c", {
      sameSite: __prod__ ? "none" : "lax",
      secure: true,
      domain: __prod__ ? "midwestdaisy.com" : undefined,
      httpOnly: true,
      maxAge: 0,
    });
  };

  next();
};
