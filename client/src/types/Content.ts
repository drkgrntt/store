import { Category } from "./Product";

export interface Content {
  id: string;
  title: string;
  detail: string;
  categories: Category[];
}
