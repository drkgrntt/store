import { Address } from "./Address";
import { Product } from "./Product";
import { User } from "./User";

export interface Order {
  id: string;
  isShipped: boolean;
  isComplete: boolean;
  shippedOn?: Date;
  completedOn?: Date;
  trackingNumber?: string;
  totalCost: number;
  userId: string;
  user: User;
  addressId: string;
  address: Address;
  orderedProducts: OrderProduct[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderProduct {
  id: string;
  count: number;
  price: number;
  product: Product;
  createdAt: Date;
  updatedAt: Date;
}
