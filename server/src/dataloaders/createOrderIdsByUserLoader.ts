import DataLoader from "dataloader";
import { Order } from "../models";

export const createOrderIdsByUserLoader = () => {
  return new DataLoader<string, string[]>(async (userIds) => {
    const orders = await Order.findAll({
      attributes: ["id", "userId"],
      where: {
        userId: userIds,
      },
    });

    // Essentially is of type Record<userId: orderId[]>
    const orderIdsMap = orders.reduce((map, order) => {
      map[order.userId] = orders
        .filter((o) => order.userId === o.userId)
        .map((o) => o.id);
      return map;
    }, {} as Record<string, string[]>);

    const sortedOrderIds = userIds.map((id) => orderIdsMap[id] || []);

    return sortedOrderIds;
  });
};
