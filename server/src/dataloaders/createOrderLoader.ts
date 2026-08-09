import DataLoader from "dataloader";
import { Order } from "../models";

export const createOrderLoader = () => {
  return new DataLoader<string, Order>(async (orderIds) => {
    const orders = await Order.findAll({
      where: {
        id: orderIds,
      },
    });

    const orderMap = orders.reduce((map, order) => {
      map[order.id] = order;
      return map;
    }, {} as Record<string, Order>);

    const sortedOrders = orderIds.map((id) => orderMap[id]);

    return sortedOrders;
  });
};
