import Image from "next/image";
import { FC, MouseEvent } from "react";
import { useCart } from "../../hooks/useCart";
import { useModal } from "../../hooks/useModal";
import { priceToCurrency, range } from "../../utils";
import Button from "../Button";
import Selectable from "../Selectable";

interface Props {
  isCheckout?: boolean;
}

const Cart: FC<Props> = ({ isCheckout }) => {
  const { cart, removeFromCart, totalCost } = useCart();
  const { openModal } = useModal();

  return (
    <div>
      {!isCheckout && <h2>Cart</h2>}
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
        Total: {priceToCurrency(totalCost)}
      </ul>
      {!isCheckout && (
        <Button onClick={() => openModal("checkout")}>Checkout</Button>
      )}
    </div>
  );
};

export default Cart;
