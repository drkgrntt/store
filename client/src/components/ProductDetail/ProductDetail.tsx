import { gql, useQuery } from "@apollo/client";
import { useRouter } from "next/router";
import { FC, useEffect, useState } from "react";
import { Product, ProductImage } from "../../types/Product";
import Error from "next/error";
import Loader from "../Loader";
import styles from "./ProductDetail.module.scss";
import Image from "next/image";
import Selectable from "../Selectable";
import { priceToCurrency } from "../../utils";
import { useModal } from "../../hooks/useModal";
import { useCart } from "../../providers/cart";
import Button from "../Button";
import Link from "next/link";
import PageHead from "../PageHead";

interface Props {}

const PRODUCT = gql`
  query Products($id: String!) {
    product(id: $id) {
      id
      title
      description
      price
      quantity
      isMadeToOrder
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
                key={image.id}
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
    </>
  );
};

export default ProductDetail;
