import { FC } from "react";
import Image from "next/image";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Product } from "../../types/Product";
import Loader from "../Loader";
import { priceToCurrency } from "../../utils";
import Selectable from "../Selectable";
import { useUser } from "../../hooks/useUser";

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

const ADD_TO_CART = gql`
  mutation AddToCart($productId: String!) {
    addToCart(productId: $productId) {
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

export const ProductList: FC<Props> = () => {
  const { data, loading } = useQuery<{ products: Product[] }>(PRODUCTS);
  const { data: { me: user } = {} } = useUser();
  const [addToCart] = useMutation(ADD_TO_CART);

  if (loading) return <Loader />;

  return (
    <div>
      {data?.products.map((product) => {
        const primaryImage =
          product.images.find((i) => i.primary) ?? product.images[0];

        const quantityInCart =
          user?.cart.find((item) => item.product.id === product.id)?.count ?? 0;

        const addProductToCart = () => {
          if (user) {
            addToCart({
              variables: { productId: product.id },
            });
          } else {
            // TODO: handle logged out
          }
        };

        return (
          <div key={product.id}>
            {primaryImage && (
              <Image
                width={200}
                height={200}
                src={primaryImage.url}
                objectFit="contain"
              />
            )}
            <h3>{product.title}</h3>
            <p>{product.description}</p>
            <p>{priceToCurrency(product.price)}</p>
            <p>{product.quantity - quantityInCart} available</p>
            {product.quantity - quantityInCart > 0 && (
              <Selectable onClick={addProductToCart}>Add to cart</Selectable>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProductList;
