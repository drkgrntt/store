import { gql, useQuery } from "@apollo/client";
import Link from "next/link";
import { FC } from "react";
import { FaPen, FaPlus } from "react-icons/fa";
import { useModal } from "../../../hooks/useModal";
import { Content } from "../../../types/Content";
import { Order } from "../../../types/Order";
import { Paginated } from "../../../types/util";
import AdminFrame from "../../AdminFrame";
import Button from "../../Button";
import OrderList from "../../OrderList";
import ProductList from "../../ProductList";
import styles from "./Admin.module.scss";

interface Props {}

const ALL_ORDERS = gql`
  query AllOrders(
    $isShipped: Boolean
    $isComplete: Boolean
    $page: Float
    $perPage: Float
  ) {
    allOrders(
      isShipped: $isShipped
      isComplete: $isComplete
      page: $page
      perPage: $perPage
    ) {
      hasMore
      nextPage
      edges {
        id
        userId
        address {
          id
          recipient
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
        paymentIntentId
        notes
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
  }
`;

const CONTENTS = gql`
  query Contents {
    contents {
      id
      title
      detail
      categories {
        id
        name
      }
    }
  }
`;

const Admin: FC<Props> = () => {
  const {
    data: { allOrders } = {},
    fetchMore,
    variables,
  } = useQuery<{
    allOrders: Paginated<Order>;
  }>(ALL_ORDERS, {
    variables: {
      perPage: 10,
    },
  });

  const { data: { contents } = {} } = useQuery<{ contents: Content[] }>(
    CONTENTS,
    { fetchPolicy: "cache-and-network" }
  );

  const { modalHref } = useModal();

  const loadMore = async () => {
    await fetchMore({
      variables: {
        page: allOrders?.nextPage,
        perPage: variables?.perPage,
      },
    });
  };

  return (
    <AdminFrame className={styles.container}>
      <div className={styles.products}>
        <h3>Products</h3>
        <ProductList adminView />
      </div>
      <div className={styles.orders}>
        <h3>Orders</h3>
        <OrderList orders={allOrders?.edges ?? []} isEditable />
        {allOrders?.hasMore && <Button onClick={loadMore}>More</Button>}
        <h3>
          Content{" "}
          <Link href={modalHref("content-form")}>
            <a>
              <FaPlus />
            </a>
          </Link>
        </h3>
        {contents?.map((content) => (
          <details key={content.id} className={styles.content}>
            <summary className={styles.contentTitle}>
              {content.title}{" "}
              <Link href={modalHref("content-form", { id: content.id })}>
                <a>
                  <FaPen />
                </a>
              </Link>
            </summary>
            {content.detail}
          </details>
        ))}
      </div>
    </AdminFrame>
  );
};

export default Admin;
