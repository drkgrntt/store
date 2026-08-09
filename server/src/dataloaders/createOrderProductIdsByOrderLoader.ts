import DataLoader from "dataloader";
import { OrderProduct } from "../models";

export const createOrderProductIdsByOrderLoader = () => {
  return new DataLoader<string, string[]>(async (orderIds) => {
    const orderProducts = await OrderProduct.findAll({
      attributes: ["id", "orderId"],
      where: {
        orderId: orderIds,
      },
    });

    // Essentially is of type Record<orderId: orderProductId[]>
    const orderProductIdsMap = orderProducts.reduce((map, orderProduct) => {
      map[orderProduct.orderId] = orderProducts
        .filter((up) => orderProduct.orderId === up.orderId)
        .map((up) => up.id);
      return map;
    }, {} as Record<string, string[]>);

    const sortedOrderProductIds = orderIds.map(
      (id) => orderProductIdsMap[id] || []
    );

    return sortedOrderProductIds;
  });
};
