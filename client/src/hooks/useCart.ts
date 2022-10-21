import { gql, useMutation } from "@apollo/client";
import { Product } from "../types/Product";
import { UserProduct } from "../types/User";
import { range } from "../utils";
import { useRerender } from "./useRerender";
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
  // From gql
  const { user, refetch } = useUser();
  const [gqlAddToCart] = useMutation(ADD_TO_CART, { onCompleted: refetch });
  const [gqlRemoveFromCart] = useMutation(REMOVE_FROM_CART, {
    onCompleted: refetch,
  });
  const rerender = useRerender();

  // If user
  const uCart = user?.cart ?? [];
  const uAddToCart = async (product: Product) => {
    await gqlAddToCart({
      variables: { productId: product.id },
    });
  };
  const uRemoveFromCart = async (product: Product) => {
    await gqlRemoveFromCart({ variables: { productId: product.id } });
  };

  // If no user
  const getLsCart = (): UserProduct[] => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage?.getItem("cart") ?? "[]");
  };
  const lsCart = getLsCart();

  const lsAddToCart = (product: Product) => {
    let newLsCart = getLsCart();
    const cartProduct = newLsCart.find(
      (item) => item.product.id === product.id
    );
    if (cartProduct) {
      newLsCart = newLsCart.map((item) => {
        if (item.product.id === cartProduct.product.id) {
          item = { ...item, count: item.count + 1 };
        }
        return item;
      });
    } else {
      newLsCart.push({
        id: Math.random().toString(), // For type safety
        product,
        count: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    localStorage.setItem("cart", JSON.stringify(newLsCart));
    rerender();
  };

  const lsRemoveFromCart = (product: Product) => {
    let newLsCart = getLsCart();
    const cartProduct = newLsCart.find(
      (item) => item.product.id === product.id
    );
    if (!cartProduct) return newLsCart;

    if (cartProduct.count <= 1) {
      newLsCart = newLsCart.filter((item) => item.product.id !== product.id);
    } else {
      newLsCart = newLsCart.map((item) => {
        if (item.product.id === cartProduct.product.id) {
          item = { ...item, count: item.count - 1 };
        }
        return item;
      });
    }
    localStorage.setItem("cart", JSON.stringify(newLsCart));
    rerender();
  };

  const cart = user ? uCart : lsCart;
  const addToCart = user ? uAddToCart : lsAddToCart;
  const removeFromCart = user ? uRemoveFromCart : lsRemoveFromCart;

  const quantityInCart = (productId: string) =>
    cart.find((item) => item.product.id === productId)?.count ?? 0;

  const totalCost = cart.reduce(
    (total, item) => total + item.product.price * item.count,
    0
  );

  const clearLsCart = () => {
    localStorage.setItem("cart", "[]");
    rerender();
  };

  const clearUCart = async () => {
    for (const item of uCart) {
      for (const i of range(item.count)) {
        await uRemoveFromCart(item.product);
      }
    }
    refetch();
  };

  const addLsCartToUCart = async () => {
    for (const item of lsCart) {
      for (const i of range(item.count)) {
        await uAddToCart(item.product);
      }
    }
    refetch();
  };

  return {
    cart,
    addToCart,
    removeFromCart,
    quantityInCart,
    totalCost,
    uCart,
    lsCart,
    addLsCartToUCart,
    clearUCart,
    clearLsCart,
  };
};
