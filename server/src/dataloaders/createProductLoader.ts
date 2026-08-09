import DataLoader from "dataloader";
import { Product } from "../models";

export const createProductLoader = () => {
  return new DataLoader<string, Product>(async (productIds) => {
    const products = await Product.findAll({
      where: {
        id: productIds,
      },
    });

    const productMap = products.reduce((map, product) => {
      map[product.id] = product;
      return map;
    }, {} as Record<string, Product>);

    const sortedProducts = productIds.map((id) => productMap[id]);

    return sortedProducts;
  });
};
