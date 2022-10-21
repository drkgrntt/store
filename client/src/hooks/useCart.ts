import { gql, useMutation } from "@apollo/client";
import { useUser } from "./useUser";

const ADD_TO_CART = gql`
  mutation AddToCart($productId: String!) {
    addToCart(productId: $productId) {
      id
      count
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
      }
    }
  }
`;

const REMOVE_FROM_CART = gql`
  mutation RemoveFromCart($productId: String!) {
    removeFromCart(productId: $productId) {
      id
      count
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
      }
    }
  }
`;

export const useCart = () => {
  const [addToCart] = useMutation(ADD_TO_CART);
  const [removeFromCart] = useMutation(REMOVE_FROM_CART);
  const { user } = useUser();
  const cart = user?.cart ?? [];

  // TODO: handle logged out here

  const quantityInCart = (productId: string) =>
    cart.find((item) => item.product.id === productId)?.count ?? 0;

  return { cart, addToCart, removeFromCart, quantityInCart };
};
