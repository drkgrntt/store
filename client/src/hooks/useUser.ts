import { gql, OperationVariables, useQuery } from "@apollo/client";
import { User } from "../types/User";

const ME = gql`
  query Me {
    me {
      id
      email
      isAdmin
      createdAt
      updatedAt
      tokens {
        id
        value
        userId
        createdAt
        updatedAt
      }
      addresses {
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
      billingAddress {
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
      shippingAddresses {
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
      orders {
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
        shippedOn
        completedOn
        trackingNumber
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
      cart {
        id
        count
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

export const useMeQuery = (options?: OperationVariables) => {
  return useQuery<{ me: User }>(ME, options);
};

export const useUser = () => {
  const { data, refetch } = useMeQuery();
  return { user: data?.me, refetch };
};
