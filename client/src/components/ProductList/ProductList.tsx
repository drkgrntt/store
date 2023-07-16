import { FC, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gql, useQuery } from "@apollo/client";
import { Category, Product } from "../../types/Product";
import Loader from "../Loader";
import { combineClasses, priceToCurrency, substring } from "../../utils";
import Selectable from "../Selectable";
import { useUser } from "../../hooks/useUser";
import styles from "./ProductList.module.scss";
import { FaChevronLeft, FaChevronRight, FaPen } from "react-icons/fa";
import Link from "next/link";
import { useModal } from "../../hooks/useModal";
import { useCart } from "../../providers/cart";
import { useRouter } from "next/router";
import { Paginated } from "../../types/util";
import Button, { ClickStateRef } from "../Button";
import Input from "../Input";
import { useDebounce } from "../../hooks/useDebounce";

interface Props {
  adminView?: boolean;
}

const PRODUCTS = gql`
  query Products(
    $active: Boolean
    $page: Float
    $perPage: Float
    $search: String
    $tagSearch: Boolean
  ) {
    products(
      active: $active
      page: $page
      perPage: $perPage
      search: $search
      tagSearch: $tagSearch
    ) {
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

const CATEGORIES = gql`
  query Categories {
    categories(list: true) {
      id
      name
    }
  }
`;

export const ProductList: FC<Props> = ({ adminView }) => {
  const { query, replace, asPath } = useRouter();
  const [isDropdown, setIsDropdown] = useState(true);

  const { data, loading, fetchMore, variables, refetch, previousData } =
    useQuery<{
      products: Paginated<Product>;
    }>(PRODUCTS, {
      variables: {
        // perPage: 1,
        search: query.search,
        active: !adminView ? true : undefined,
        tagSearch: isDropdown,
      },
    });
  const { data: { categories = [] } = {} } = useQuery<{
    categories: Category[];
  }>(CATEGORIES);

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

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    brand: {
      "@type": "Brand",
      name: "Midwest Daisy Collective",
    },
    description:
      "Small-batch colorful and quirky earrings (and a few things in between)",
    url: `${process.env.NEXT_PUBLIC_APP_URL}${asPath}`,
    numberOfItems: (data?.products.edges.length ?? 0).toString(),
    itemListElement: data?.products.edges.map((product) => ({
      "@type": "Product",
      image: (product.images.find((i) => i.primary) ?? product.images[0])?.url,
      url: `${process.env.NEXT_PUBLIC_APP_URL}?modal=detail&modal-params=id&id=${product.id}`,
      name: product.title,
      offers: {
        priceCurrency: "USD",
        "@type": "Offer",
        price: (product.price / 100).toFixed(2),
        availability: "InStock",
      },
    })),
  };

  return (
    <>
      <Input
        isClearable
        className={styles.search}
        value={query.search as string}
        onChange={(event) =>
          replace(
            { query: { ...query, search: event.target.value || [] } },
            undefined,
            { scroll: false }
          )
        }
        name="search"
        label="Search"
        placeholder={isDropdown ? "Categories" : "Polymer Clay"}
        type={isDropdown ? "select" : "text"}
        options={
          isDropdown
            ? categories.map((c) => ({ value: c.name, text: c.name }))
            : undefined
        }
        action={{
          text: isDropdown ? "Custom Search" : "View Categories",
          handler: () => setIsDropdown((prev) => !prev),
        }}
      />
      <div className={styles.products}>
        {(data || previousData)?.products.edges.map((product) => (
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
      {!query.modal && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }}
        />
      )}
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
            title="Previous image"
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
            title="Edit product"
            href={modalHref("product-form", { id: product.id })}
            className={styles.editButton}
            scroll={false}
          >
            <FaPen />
          </Link>
        )}
        {selectedImage && (
          <Link
            // href={modalHref("image", {
            //   alt:
            //     selectedImage.title ?? `The selected image of ${product.title}`,
            //   src: selectedImage.url,
            // })}
            href={modalHref("detail", { id: product.id })}
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
            title="Next image"
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
      <Link
        className={styles.titleLink}
        href={modalHref("detail", { id: product.id })}
        scroll={false}
      >
        <h2 className={styles.title}>{product.title}</h2>
      </Link>
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
