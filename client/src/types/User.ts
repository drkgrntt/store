import { Product } from "./Product";
import { Order } from "./Order";
import { Address } from "./Address";

export interface User {
  id: string;
  email: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  tokens: Token[];
  cart: UserProduct[];
  addresses: Address[];
  billingAddress?: Address;
  shippingAddresses: Address[];
  orders: Order[];
}

export interface Token {
  id: string;
  userId: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProduct {
  id: string;
  product: Product;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}
