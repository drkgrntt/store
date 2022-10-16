import { gql, useMutation } from "@apollo/client";
import Image from "next/image";
import { FC, MouseEvent } from "react";
import { useUser } from "../../hooks/useUser";
import { priceToCurrency, range } from "../../utils";
import Selectable from "../Selectable";

interface Props {}

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

const Cart: FC<Props> = () => {
  const { user } = useUser();
  const [removeFromCart] = useMutation(REMOVE_FROM_CART);

  // TODO: handle logged out
  const cart = user?.cart ?? [];

  const total = cart.reduce(
    (total, item) => total + item.product.price * item.count,
    0
  );

  return (
    <div>
      <h2>Cart</h2>
      <ul>
        {cart.map((item) => {
          const handleItemClick = (event: MouseEvent<HTMLAnchorElement>) => {
            event.stopPropagation();

            if (user) {
              removeFromCart({ variables: { productId: item.product.id } });
            } else {
              // TODO: handle logged out
            }
          };

          return (
            <li key={item.id}>
              <details>
                <summary>
                  {item.product.title} - x{item.count} -{" "}
                  {priceToCurrency(item.product.price * item.count)} -{" "}
                  <Selectable onClick={handleItemClick}>Remove one</Selectable>
                </summary>

                {item.product.images.map((image) => {
                  return (
                    <Image
                      key={image.url}
                      height={120}
                      width={120}
                      objectFit="contain"
                      src={image.url}
                      alt={image.title}
                    />
                  );
                })}
                <ul>
                  {range(item.count).map((i) => {
                    return (
                      <li key={i}>+ {priceToCurrency(item.product.price)}</li>
                    );
                  })}
                </ul>
              </details>
            </li>
          );
        })}
        Total: {priceToCurrency(total)}
      </ul>
    </div>
  );
};

export default Cart;
