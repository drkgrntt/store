import Image from "next/image";
import { FC, MouseEvent } from "react";
import { useModal } from "../../hooks/useModal";
import { useUser } from "../../hooks/useUser";
import { useCart } from "../../providers/cart";
import { priceToCurrency, range } from "../../utils";
import Button from "../Button";
import Selectable from "../Selectable";
import styles from "./Cart.module.scss";

interface Props {
  isCheckout?: boolean;
}

const Cart: FC<Props> = ({ isCheckout }) => {
  const {
    cart,
    removeFromCart,
    totalCost,
    uCart,
    lsCart,
    clearLsCart,
    clearUCart,
    addLsCartToUCart,
    totalQuantity,
  } = useCart();
  const { user } = useUser();
  const { openModal } = useModal();

  return (
    <div>
      {user && !!lsCart.length && (
        <details>
          <summary>
            Your cart is different from what it was before logging in. Would you
            like to correct that?
          </summary>
          <div className={styles.options}>
            <Button
              onClick={async () => {
                await addLsCartToUCart();
                clearLsCart();
              }}
            >
              Combine carts
            </Button>
            <Button
              onClick={async () => {
                await clearUCart();
                await addLsCartToUCart();
                clearLsCart();
              }}
            >
              Use the other cart
            </Button>
            <Button onClick={clearLsCart}>Use this cart</Button>
          </div>
          <div className={styles.cartCompare}>
            <ul>
              <h4>This cart</h4>
              {uCart.map((item) => (
                <li key={item.id}>
                  {item.product.title} x{item.count}
                </li>
              ))}
            </ul>
            <ul>
              <h4>The other cart</h4>
              {lsCart.map((item) => (
                <li key={item.id}>
                  {item.product.title} x{item.count}
                </li>
              ))}
            </ul>
          </div>
          <hr />
        </details>
      )}
      {!isCheckout && <h2>Cart</h2>}
      <ul>
        {cart.map((item) => {
          const handleItemClick = (event: MouseEvent<HTMLAnchorElement>) => {
            event.stopPropagation();
            removeFromCart(item.product);
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
                      src={image.url}
                      alt={image.title ?? item.product.title}
                      className={styles.image}
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
      {!isCheckout && !!totalQuantity && (
        <Button onClick={() => openModal("checkout")}>Checkout</Button>
      )}
    </div>
  );
};

export default Cart;
