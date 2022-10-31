import Link from "next/link";
import { FC } from "react";
import { FaPen } from "react-icons/fa";
import { useModal } from "../../hooks/useModal";
import { useUser } from "../../hooks/useUser";
import { Order } from "../../types/Order";
import { priceToCurrency } from "../../utils";
import styles from "./OrderList.module.scss";

interface Props {
  orders: Order[];
  isEditable?: boolean;
}

const OrderList: FC<Props> = ({ orders, isEditable }) => {
  const { user } = useUser();
  const { modalHref } = useModal();
  return (
    <div>
      {orders.map((order) => {
        return (
          <details key={order.id} open className={styles.item}>
            <summary>
              {order.createdAt.toLocaleDateString()} -{" "}
              {priceToCurrency(order.totalCost)}
            </summary>
            {isEditable && user?.isAdmin && (
              <Link href={modalHref("order-edit-form", { id: order.id })}>
                <a className={styles.editButton}>
                  <FaPen className={styles.edit} />
                </a>
              </Link>
            )}
            <ul>
              <li>Order ID: {order.id}</li>
              <li>
                {!order.isShipped && "Not "}Shipped
                {order.isShipped && ` ${order.shippedOn?.toLocaleDateString()}`}
              </li>
              {order.trackingNumber && (
                <li>Tracking Number: {order.trackingNumber}</li>
              )}
              <li>
                {!order.isComplete && "Not "}Completed
                {order.isComplete &&
                  ` ${order.completedOn?.toLocaleDateString()}`}
              </li>
              {order.orderedProducts.map((orderedProduct) => {
                return (
                  <li key={orderedProduct.id}>
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
