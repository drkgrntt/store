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
        addressId
        totalCost
        isShipped
        isComplete
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

export const useUser = (options?: OperationVariables) => {
  return useQuery<{ me: User }>(ME, options);
};
