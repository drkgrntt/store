import { FC } from "react";
import { Order } from "../../types/Order";
import { priceToCurrency } from "../../utils";

interface Props {
  orders: Order[];
}

const OrderList: FC<Props> = ({ orders }) => {
  return (
    <div>
      <h3>Orders</h3>
      {orders.map((order) => {
        return (
          <details key={order.id}>
            <summary>
              {order.createdAt.toLocaleDateString()} -{" "}
              {priceToCurrency(order.totalCost)}
            </summary>
            <ul>
              <li>Shipped: {order.isShipped.toString()}</li>
              <li>Complete: {order.isComplete.toString()}</li>
              {order.orderedProducts.map((orderedProduct) => {
                return (
                  <li>
                    {orderedProduct.count}x - {orderedProduct.product.title} -{" "}
                    {priceToCurrency(orderedProduct.price)}
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
};

export default OrderList;
