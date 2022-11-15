import DataLoader from "dataloader";
import { OrderProduct } from "../models";

export const createOrderProductLoader = () => {
  return new DataLoader<string, OrderProduct>(async (orderProductIds) => {
    const orderProducts = await OrderProduct.findAll({
      where: {
        id: orderProductIds,
      },
    });

    const orderProductMap = orderProducts.reduce((map, orderProduct) => {
      map[orderProduct.id] = orderProduct;
      return map;
    }, {} as Record<string, OrderProduct>);

    const sortedOrderProducts = orderProductIds.map(
      (id) => orderProductMap[id]
    );

    return sortedOrderProducts;
  });
};
