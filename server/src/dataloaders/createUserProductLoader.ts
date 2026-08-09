import DataLoader from "dataloader";
import { UserProduct } from "../models";

export const createUserProductLoader = () => {
  return new DataLoader<string, UserProduct>(async (userProductIds) => {
    const userProducts = await UserProduct.findAll({
      where: {
        id: userProductIds,
      },
    });

    const userProductMap = userProducts.reduce((map, userProduct) => {
      map[userProduct.id] = userProduct;
      return map;
    }, {} as Record<string, UserProduct>);

    const sortedUserProducts = userProductIds.map((id) => userProductMap[id]);

    return sortedUserProducts;
  });
};
