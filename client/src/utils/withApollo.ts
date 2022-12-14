import { NextPageContext } from "next";
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  ApolloLink,
  NormalizedCacheObject,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { createWithApollo } from "./createWithApollo";
import { AppProps } from "next/app";
import { Paginated } from "../types/util";
import { Product } from "../types/Product";
import { Order } from "../types/Order";

const POSSIBLE_DATE_FIELDS = [
  "createdAt",
  "updatedAt",
  "completedOn",
  "shippedOn",
];

const createClient = (ctx: NextPageContext) => {
  const httpLink = createHttpLink({
    uri: process.env.NEXT_PUBLIC_API_URL,
    credentials: "include",
  });

  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        cookie:
          (typeof window === "undefined"
            ? ctx?.req?.headers.cookie
            : undefined) || "",
      },
    };
  });

  /**
   * The server will return dates as iso strings,
   * so this will to convert those to date objects
   */
  const convertDates = (data: any) => {
    if (!data) return data;
    Object.keys(data).forEach((key) => {
      switch (typeof data[key]) {
        case "string":
          if (POSSIBLE_DATE_FIELDS.includes(key)) {
            // This is what we came here to do
            data[key] = new Date(data[key]);
          }
          break;
        case "object":
          convertDates(data[key]);
          break;
      }
    });

    return data;
  };

  const dataMutationLink = new ApolloLink((operation, forward) => {
    return forward(operation).map((data) => {
      data = convertDates(data);
      return data;
    });
  });

  const inMemoryCache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          products: {
            keyArgs: [],
            merge(
              existing: Paginated<Product> | undefined,
              incoming: Paginated<Product>
            ): Paginated<Product> {
              return {
                ...incoming,
                edges: [...(existing?.edges || []), ...incoming.edges],
              };
            },
          },
          allOrders: {
            keyArgs: [],
            merge(
              existing: Paginated<Order> | undefined,
              incoming: Paginated<Order>
            ): Paginated<Order> {
              return {
                ...incoming,
                edges: [...(existing?.edges || []), ...incoming.edges],
              };
            },
          },
        },
      },
    },
  });

  if (typeof window !== "undefined") {
    inMemoryCache.restore(__NEXT_DATA__.props.pageProps.apolloState || {});
  }

  return new ApolloClient({
    link: dataMutationLink.concat(authLink).concat(httpLink),
    cache: inMemoryCache,
    name: "react-web-client",
    version: "1.0.0",
  });
};

export const withApollo = createWithApollo(createClient);
