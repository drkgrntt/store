import DataLoader from "dataloader";
import { UserProduct } from "../models";

export const createUserProductIdsByUserLoader = () => {
  return new DataLoader<string, string[]>(async (userIds) => {
    const userProducts = await UserProduct.findAll({
      attributes: ["id", "userId"],
      where: {
        userId: userIds,
      },
    });

    // Essentially is of type Record<userId: userProductId[]>
    const userProductIdsMap = userProducts.reduce((map, userProduct) => {
      map[userProduct.userId] = userProducts
        .filter((up) => userProduct.userId === up.userId)
        .map((up) => up.id);
      return map;
    }, {} as Record<string, string[]>);

    const sortedUserProductIds = userIds.map(
      (id) => userProductIdsMap[id] || []
    );

    return sortedUserProductIds;
  });
};
