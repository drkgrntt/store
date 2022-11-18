import { FC, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gql, useQuery } from "@apollo/client";
import { Product } from "../../types/Product";
import Loader from "../Loader";
import { combineClasses, priceToCurrency, substring } from "../../utils";
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
import Input from "../Input";
import { useDebounce } from "../../hooks/useDebounce";
import { ClickStateRef } from "../Button/Button";
import { withApollo } from "../../utils/withApollo";

interface Props {
  adminView?: boolean;
}

const PRODUCTS = gql`
  query Products(
    $active: Boolean
    $page: Float
    $perPage: Float
    $search: String
  ) {
    products(active: $active, page: $page, perPage: $perPage, search: $search) {
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

export const ProductList: FC<Props> = ({ adminView }) => {
  const { query, replace } = useRouter();

  const { data, loading, fetchMore, variables, refetch } = useQuery<{
    products: Paginated<Product>;
  }>(PRODUCTS, {
    variables: {
      // perPage: 1,
      search: query.search,
      active: !adminView ? true : undefined,
    },
  });

  const enableButtonRef = useRef<ClickStateRef>();

  const debouncedSearch = useDebounce(refetch);
  useEffect(debouncedSearch, [query.search]);

  const loadMore = async () => {
    await fetchMore({
      variables: {
        search: query.search,
        page: data?.products.nextPage,
        perPage: variables?.perPage,
        active: variables?.active,
      },
    });
    enableButtonRef.current?.();
  };

  return (
    <>
      <Input
        className={styles.search}
        value={query.search as string}
        onChange={(event) =>
          replace({ query: { ...query, search: event.target.value || [] } })
        }
        name="search"
        label="Search"
      />
      <div className={styles.products}>
        {data?.products.edges.map((product) => (
          <ProductListItem key={product.id} product={product} />
        ))}
      </div>
      <div className={styles.load}>
        {loading && <Loader />}
        {data?.products.hasMore && (
          <Button onClick={loadMore} enableButtonRef={enableButtonRef}>
            More
          </Button>
        )}
      </div>
      <Modal name="image" wide>
        <Image
          src={query.src as string}
          alt={query.alt as string}
          height={600}
          width={1200}
          className={styles.modalImage}
        />
      </Modal>
    </>
  );
};

const ProductListItem: FC<{ product: Product }> = ({ product }) => {
  const { user } = useUser();
  const { modalHref } = useModal();
  const { addToCart, quantityInCart } = useCart();
  const [isReadMore, setIsReadMore] = useState(false);

  const [selectedImageIndex, setSelectedImageIndex] = useState(
    product.images.findIndex((i) => i.primary) > -1
      ? product.images.findIndex((i) => i.primary)
      : 0
  );

  const availableQuantity = product.quantity - quantityInCart(product.id);
  const selectedImage = product.images[selectedImageIndex];

  const addProductToCart = () => addToCart(product);

  return (
    <div
      className={combineClasses(
        styles.product,
        !product.isActive ? styles.inactive : ""
      )}
    >
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
          <Link
            href={modalHref("product-form", { id: product.id })}
            className={styles.editButton}
            scroll={false}
          >
            <FaPen />
          </Link>
        )}
        {selectedImage && (
          <Link
            href={modalHref("image", {
              alt:
                selectedImage.title ?? `The selected image of ${product.title}`,
              src: selectedImage.url,
            })}
            scroll={false}
          >
            {product.images.map((image) => (
              <Image
                key={image.id}
                alt={
                  selectedImage.title ??
                  `The selected image of ${product.title}`
                }
                width={600}
                height={600}
                src={selectedImage.url}
                className={combineClasses(
                  styles.selectedImage,
                  selectedImage.id === image.id ? "" : styles.hidden
                )}
              />
            ))}
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
      <p className={styles.description}>
        {isReadMore ? (
          product.description
        ) : (
          <>
            {substring(product.description)[0]}{" "}
            {substring(product.description)[1] && (
              <Selectable onClick={() => setIsReadMore(true)}>
                Read More
              </Selectable>
            )}
          </>
        )}
      </p>
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
