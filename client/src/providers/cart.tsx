import { createContext, FC, ReactNode, useContext } from "react";
import { gql, useMutation } from "@apollo/client";
import { Product } from "../types/Product";
import { UserProduct } from "../types/User";
import { range } from "../utils";
import { useUser } from "../hooks/useUser";
import { useRerender } from "../hooks/useRerender";

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

type CartContext = {
  cart: UserProduct[];
  addToCart: (product: Product) => Promise<void> | void;
  removeFromCart: (product: Product) => Promise<void> | void;
  quantityInCart: (productId: string) => number;
  totalCost: number;
  subTotal: number;
  tax: number;
  shipping: number;
  totalQuantity: number;
  uCart: UserProduct[];
  lsCart: UserProduct[];
  addLsCartToUCart: () => Promise<void>;
  clearUCart: () => Promise<void>;
  clearLsCart: () => void;
};

export const cartContext = createContext<CartContext>({
  cart: [],
  addToCart: async () => {},
  removeFromCart: async () => {},
  quantityInCart: () => 0,
  totalCost: 0,
  subTotal: 0,
  tax: 0,
  shipping: 0,
  totalQuantity: 0,
  uCart: [],
  lsCart: [],
  addLsCartToUCart: async () => {},
  clearUCart: async () => {},
  clearLsCart: () => {},
});

interface Props {
  children?: ReactNode;
}

const CartProvider: FC<Props> = ({ children }) => {
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
    if (!cartProduct) return;

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

  const subTotal = cart.reduce(
    (total, item) => total + item.product.price * item.count,
    0
  );

  const shipping = 0;

  const tax = Math.floor(subTotal * 0.08725);

  const totalCost = subTotal + shipping + tax;

  const totalQuantity = cart.reduce((total, item) => total + item.count, 0);

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

  return (
    <cartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        quantityInCart,
        totalCost,
        subTotal,
        tax,
        shipping,
        totalQuantity,
        uCart,
        lsCart,
        addLsCartToUCart,
        clearUCart,
        clearLsCart,
      }}
    >
      {children}
    </cartContext.Provider>
  );
};

export const useCart = () => useContext(cartContext);

export default CartProvider;
