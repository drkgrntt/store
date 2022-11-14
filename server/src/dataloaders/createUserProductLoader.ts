import DataLoader from "dataloader";
import { Product, UserProduct } from "../models";

export const createUserProductLoader = () => {
  return new DataLoader<string, UserProduct>(async (userProductIds) => {
    const userProducts = await UserProduct.findAll({
      where: {
        id: userProductIds,
      },
      include: Product,
    });

    const userProductMap = userProducts.reduce((map, userProduct) => {
      map[userProduct.id] = userProduct;
      return map;
    }, {} as Record<string, UserProduct>);

    const sortedUserProducts = userProductIds.map((id) => userProductMap[id]);

    return sortedUserProducts;
  });
};
