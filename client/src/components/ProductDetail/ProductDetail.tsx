import { gql, useQuery } from "@apollo/client";
import { useRouter } from "next/router";
import { FC, useEffect, useState } from "react";
import { Product, ProductImage } from "../../types/Product";
import Error from "next/error";
import Loader from "../Loader";
import styles from "./ProductDetail.module.scss";
import Image from "next/image";
import Selectable from "../Selectable";
import { getMobileOperatingSystem, priceToCurrency } from "../../utils";
import { useModal } from "../../hooks/useModal";
import { useCart } from "../../providers/cart";
import Button from "../Button";
import Link from "next/link";
import PageHead from "../PageHead";
import { FaShareAlt } from "react-icons/fa";
import { useNotification } from "../../providers/notification";

interface Props {}

const PRODUCT = gql`
  query Product($id: String!) {
    product(id: $id) {
      id
      title
      description
      price
      quantity
      isMadeToOrder
      relatedProducts {
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
      categories {
        id
        name
      }
      images {
        id
        url
        title
        description
        primary
      }
    }
  }
`;

const ProductDetail: FC<Props> = () => {
  const { openModal, modalHref } = useModal();
  const { addToCart, quantityInCart } = useCart();
  const { query, asPath } = useRouter();
  const { createToastNotification } = useNotification();

  const { data: { product } = {}, loading } = useQuery<{ product: Product }>(
    PRODUCT,
    {
      variables: { id: query.id },
      skip: !query.id,
    }
  );

  const [selectedImage, setSelectedImage] = useState<ProductImage>();

  useEffect(() => {
    if (!product) return;
    const image =
      product.images.find((image) => image.primary) ?? product.images[0];
    setSelectedImage(image);
  }, [product]);

  if (loading) return <Loader />;
  if (!product) return <Error title="Not found" statusCode={404} />;

  const availableQuantity = product.quantity - quantityInCart(product.id);

  const jsonld = {
    "@context": "http://schema.org",
    "@type": "Product",
    brand: {
      "@type": "Brand",
      name: "Midwest Daisy Collective",
    },
    sku: null,
    description: product.description,
    url: `${process.env.NEXT_PUBLIC_APP_URL}${asPath}`,
    name: product.title,
    image: (product.images.find((image) => image.primary) ?? product.images[0])
      ?.url,
    itemCondition: "https://schema.org/NewCondition",
    offers: [
      {
        "@type": "Offer",
        price: (product.price / 100).toFixed(2),
        priceCurrency: "USD",
        itemCondition: "http://schema.org/NewCondition",
        url: `${process.env.NEXT_PUBLIC_APP_URL}${asPath}`,
        sku: null,
        availability: "InStock",
      },
    ],
  };

  const share = () => {
    if (!!window.navigator.canShare && getMobileOperatingSystem()) {
      navigator.share({
        title: "Midwest Daisy",
        text: product.title,
        url: window.location.href,
      });
    } else {
      window.navigator.clipboard.writeText(window.location.href);
      createToastNotification({
        title: "Sharable link copied to clipboard!",
        body: window.location.href,
      });
    }
  };

  return (
    <>
      <PageHead
        title={`${product.title} | Midwest Daisy Collective`}
        image={
          (product.images.find((image) => image.primary) ?? product.images[0])
            ?.url
        }
        description={product.description}
        keywords={`${product.categories.map(({ name }) => name).join(" ")} ${
          product.title
        }`}
      />
      <div className={styles.container}>
        <div className={styles.images}>
          <Selectable onClick={share} className={styles.share}>
            <FaShareAlt />
          </Selectable>
          {selectedImage && (
            <Link
              href={modalHref("image", {
                alt:
                  selectedImage.title ??
                  `The selected image of ${product.title}`,
                src: selectedImage.url,
                prev: asPath,
              })}
              scroll={false}
            >
              <Image
                src={selectedImage.url}
                alt="Selected product image"
                height={500}
                width={500}
                className={styles.selectedImage}
              />
            </Link>
          )}
          <div className={styles.otherImages}>
            {product.images.map((image) => (
              <Selectable
                key={`sel-${image.id}`}
                onClick={() => setSelectedImage(image)}
              >
                <Image
                  src={image.url}
                  alt="Other product image"
                  height={100}
                  width={100}
                  className={styles.otherImage}
                />
              </Selectable>
            ))}
          </div>
        </div>
        <div className={styles.info}>
          <h2 className={styles.title}>{product.title}</h2>
          <div className={styles.priceAndQuantity}>
            <p>{availableQuantity < 0 ? 0 : availableQuantity} available</p>
            {product.isMadeToOrder && <p>Made to order</p>}
            <p>{priceToCurrency(product.price)}</p>
          </div>
          <p className={styles.description}>{product.description}</p>

          <div className={styles.actions}>
            {(availableQuantity > 0 || product.isMadeToOrder) && (
              <Button onClick={() => addToCart(product)}>Add to Cart</Button>
            )}
            <Button onClick={() => openModal("checkout")}>Checkout</Button>
          </div>
        </div>
      </div>
      {!!product.relatedProducts.length && (
        <div>
          <h3>You might also like</h3>
          <div className={styles.relatedProducts}>
            {product.relatedProducts.map((relatedProduct, i) => {
              return (
                <Link
                  title={relatedProduct.title}
                  key={`rp-${relatedProduct.id}`}
                  href={modalHref("detail", {
                    id: relatedProduct.id,
                  })}
                  scroll={false}
                  className={styles.relatedProductLink}
                >
                  <Image
                    width={100}
                    height={100}
                    className={styles.relatedProductImage}
                    src={
                      (
                        relatedProduct.images.find((image) => image.primary) ??
                        relatedProduct.images[0]
                      )?.url
                    }
                    alt={relatedProduct.title}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }}
      />
    </>
  );
};

export default ProductDetail;
