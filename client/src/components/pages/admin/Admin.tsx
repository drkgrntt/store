import { gql, useQuery } from "@apollo/client";
import { FC } from "react";
import AdminFrame from "../../AdminFrame";
import OrderList from "../../OrderList";
import ProductList from "../../ProductList";
import styles from "./Admin.module.scss";

interface Props {}

const ALL_ORDERS = gql`
  query AllOrders {
    allOrders {
      id
      userId
      address {
        id
        lineOne
        lineTwo
        city
        state
        zipCode
        country
        type
        userId
        createdAt
        updatedAt
      }
      totalCost
      isShipped
      isComplete
      trackingNumber
      shippedOn
      completedOn
      createdAt
      orderedProducts {
        id
        count
        price
        createdAt
        updatedAt
        product {
          id
          title
          description
          price
          quantity
          isMadeToOrder
          isActive
          createdAt
          updatedAt
          images {
            id
            url
            title
            description
            primary
            createdAt
            updatedAt
          }
        }
      }
    }
  }
`;

const Admin: FC<Props> = () => {
  const { data: { allOrders } = {} } = useQuery(ALL_ORDERS);

  return (
    <AdminFrame className={styles.container}>
      <div className={styles.products}>
        <h3>Products</h3>
        <ProductList adminView />
      </div>
      <div className={styles.orders}>
        <h3>Orders</h3>
        <OrderList orders={allOrders ?? []} isEditable />
      </div>
    </AdminFrame>
  );
};

export default Admin;
