import { NextFunction, Request, Response } from "express";

export const handleTokens = (_: Request, res: Response, next: NextFunction) => {
  res.setToken = (value: string) => {
    res.cookie("token", value, {
      sameSite: "none", //__prod__ ? "none" : "lax",
      secure: true, //__prod__,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
  };

  res.removeToken = () => {
    res.cookie("token", "a.b.c", {
      sameSite: "none", //__prod__ ? "none" : "lax",
      secure: true, //__prod__,
      httpOnly: true,
      maxAge: 0,
    });
  };

  next();
};
