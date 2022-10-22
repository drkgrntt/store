import { FC, useState } from "react";
import Image from "next/image";
import { gql, useQuery } from "@apollo/client";
import { Product } from "../../types/Product";
import Loader from "../Loader";
import { combineClasses, priceToCurrency } from "../../utils";
import Selectable from "../Selectable";
import { useUser } from "../../hooks/useUser";
import styles from "./ProductList.module.scss";
import { FaChevronLeft, FaChevronRight, FaPen } from "react-icons/fa";
import Link from "next/link";
import { useModal } from "../../hooks/useModal";
import { useCart } from "../../providers/cart";
import Modal from "../Modal";
import { useRouter } from "next/router";

interface Props {}

const PRODUCTS = gql`
  query Products {
    products(active: true) {
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
`;

export const ProductList: FC<Props> = () => {
  const { data, loading } = useQuery<{ products: Product[] }>(PRODUCTS, {
    fetchPolicy: "cache-and-network",
  });
  const { query } = useRouter();

  if (loading) return <Loader />;

  // [
  //   ...(data?.products ?? []),
  //   ...(data?.products ?? []),
  //   ...(data?.products ?? []),
  //   ...(data?.products ?? []),
  //   ...(data?.products ?? []),
  //   ...(data?.products ?? []),
  // ]

  return (
    <>
      <div className={styles.products}>
        {data?.products.map((product) => (
          <ProductListItem key={product.id} product={product} />
        ))}
      </div>
      <Modal name="image" wide>
        <Image
          src={query.src as string}
          alt={query.alt as string}
          height={600}
          width={1200}
          objectFit="scale-down"
        />
      </Modal>
    </>
  );
};

const ProductListItem: FC<{ product: Product }> = ({ product }) => {
  const { user } = useUser();
  const { modalHref } = useModal();
  const { addToCart, quantityInCart } = useCart();

  const [selectedImageIndex, setSelectedImageIndex] = useState(
    product.images.findIndex((i) => i.primary) > -1
      ? product.images.findIndex((i) => i.primary)
      : 0
  );

  const availableQuantity = product.quantity - quantityInCart(product.id);

  const addProductToCart = () => {
    addToCart(product);
  };

  return (
    <div>
      <div className={styles.imageContainer}>
        {product.images.length > 1 && (
          <Selectable
            onClick={() =>
              setSelectedImageIndex((prev) =>
                prev - 1 < 0 ? product.images.length - 1 : prev - 1
              )
            }
            className={combineClasses(styles.imageNav, styles.left)}
          >
            <FaChevronLeft />
          </Selectable>
        )}
        {user?.isAdmin && (
          <Link href={modalHref("product-form", { id: product.id })}>
            <a className={styles.editButton}>
              <FaPen />
            </a>
          </Link>
        )}
        {product.images[selectedImageIndex] && (
          <Link
            href={modalHref("image", {
              alt:
                product.images[selectedImageIndex].title ??
                `The selected image of ${product.title}`,
              src: product.images[selectedImageIndex].url,
            })}
          >
            <a>
              <Image
                alt={
                  product.images[selectedImageIndex].title ??
                  `The selected image of ${product.title}`
                }
                width={200}
                height={200}
                src={product.images[selectedImageIndex].url}
                objectFit="contain"
              />
            </a>
          </Link>
        )}
        {product.images.length > 1 && (
          <Selectable
            onClick={() => {
              setSelectedImageIndex((prev) =>
                prev + 1 >= product.images.length ? 0 : prev + 1
              );
            }}
            className={combineClasses(styles.imageNav, styles.right)}
          >
            <FaChevronRight />
          </Selectable>
        )}
      </div>
      <h3>{product.title}</h3>
      <p>{product.description}</p>
      <p>{priceToCurrency(product.price)}</p>
      <p>{availableQuantity < 0 ? 0 : availableQuantity} available</p>
      {product.isMadeToOrder && <p>Made to order</p>}
      {(availableQuantity > 0 || product.isMadeToOrder) && (
        <Selectable onClick={addProductToCart}>Add to cart</Selectable>
      )}
    </div>
  );
};

export default ProductList;
