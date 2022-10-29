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
import { Paginated } from "../../types/util";
import Button from "../Button";

interface Props {}

const PRODUCTS = gql`
  query Products($page: Float, $perPage: Float) {
    products(active: true, page: $page, perPage: $perPage) {
      hasMore
      nextPage
      edges {
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
`;

export const ProductList: FC<Props> = () => {
  const { data, loading, fetchMore, variables } = useQuery<{
    products: Paginated<Product>;
  }>(PRODUCTS, {
    fetchPolicy: "cache-and-network",
    // variables: { perPage: 1 },
  });
  const { query } = useRouter();

  const loadMore = async () => {
    await fetchMore({
      variables: {
        page: data?.products.nextPage,
        perPage: variables?.perPage,
      },
    });
  };

  // [
  //   ...(data?.products ?? []),
  //   ...(data?.products ?? []),
  //   ...(data?.products ?? []),
  //   ...(data?.products ?? []),
  //   ...(data?.products ?? []),
  //   ...(data?.products ?? []),
  // ];

  return (
    <>
      <div className={styles.products}>
        {data?.products.edges.map((product) => (
          <ProductListItem key={product.id} product={product} />
        ))}
      </div>
      <div className={styles.load}>
        {loading && <Loader />}
        {data?.products.hasMore && <Button onClick={loadMore}>More</Button>}
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
  const selectedImage = product.images[selectedImageIndex];

  const addProductToCart = () => addToCart(product);

  return (
    <div className={styles.product}>
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
        {selectedImage && (
          <Link
            href={modalHref("image", {
              alt:
                selectedImage.title ?? `The selected image of ${product.title}`,
              src: selectedImage.url,
            })}
          >
            <a>
              <Image
                alt={
                  selectedImage.title ??
                  `The selected image of ${product.title}`
                }
                width={600}
                height={600}
                src={selectedImage.url}
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
