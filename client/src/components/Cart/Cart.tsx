import { gql, useMutation } from "@apollo/client";
import Image from "next/image";
import { FC, MouseEvent } from "react";
import { useCart } from "../../hooks/useCart";
import { useUser } from "../../hooks/useUser";
import { priceToCurrency, range } from "../../utils";
import Selectable from "../Selectable";

interface Props {}

const Cart: FC<Props> = () => {
  const { cart, removeFromCart } = useCart();

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
            removeFromCart({ variables: { productId: item.product.id } });
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
                  {range(item.count).map((i) => (
                    <li key={i}>+ {priceToCurrency(item.product.price)}</li>
                  ))}
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
