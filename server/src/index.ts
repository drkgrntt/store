import "dotenv-safe/config";
import express from "express";
import cors from "cors";
import sanitize from "sanitize";
import { buildSchema } from "type-graphql";
import { __prod__ } from "./constants";
import { ApolloServer } from "apollo-server-express";
import {
  ProductResolver,
  UserResolver,
  ImageResolver,
  AddressResolver,
  CartResolver,
  OrderResolver,
  OrderedProductResolver,
} from "./resolvers";
import { Sequelize } from "sequelize-typescript";
import cookieParser from "cookie-parser";
import {
  UserProduct,
  Product,
  User,
  Token,
  ProductImage,
  Order,
  OrderProduct,
  Address,
} from "./models";
import { handleTokens } from "./middleware/handleTokens";

const main = async () => {
  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    logging: console.log,
    ssl: __prod__,
    models: [
      Address,
      Token,
      User,
      Product,
      UserProduct,
      ProductImage,
      Order,
      OrderProduct,
    ],
  });
  await sequelize.sync();

  const app = express();
  app.use(sanitize.middleware);
  app.use(cookieParser());
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(handleTokens);

  const server = new ApolloServer({
    schema: await buildSchema({
      resolvers: [
        UserResolver,
        ProductResolver,
        ImageResolver,
        CartResolver,
        AddressResolver,
        OrderResolver,
        OrderedProductResolver,
      ],
      validate: false,
    }),
    context: async ({ req, res }) => {
      if (req.body.operationName === "IntrospectionQuery") return {};

      let me;

      const { token } = req.cookies;
      if (token) {
        me = await Token.verifyAndFindUser(token);
        if (!me) {
          res.removeToken();
        }
      }

      return {
        req,
        res,
        me,
        token,
        sequelize,
      };
    },
  });

  await server.start();

  server.applyMiddleware({
    app,
    cors: {
      credentials: true,
      origin: "https://studio.apollographql.com",
    },
  });

  app.listen(parseInt(process.env.PORT), () => {
    console.log(`Server started on ${process.env.PORT}`);
  });
};

try {
  main();
} catch (error) {
  console.error(error);
}
