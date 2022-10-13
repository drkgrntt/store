import { FC } from "react";
import Image from "next/image";
import { gql, useQuery } from "@apollo/client";
import { Product } from "../../types/Product";
import Loader from "../Loader";
import { priceToCurrency } from "../../utils";

interface Props {}

const PRODUCTS = gql`
  query Products {
    products {
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
  const { data, loading } = useQuery<{ products: Product[] }>(PRODUCTS);

  if (loading) return <Loader />;

  return (
    <div>
      {data?.products.map((product) => {
        const primaryImage =
          product.images.find((i) => i.primary) ?? product.images[0];

        return (
          <div key={product.id}>
            {primaryImage && (
              <Image width={200} height={200} src={primaryImage.url} />
            )}
            <h3>{product.title}</h3>
            <p>{product.description}</p>
            <p>{priceToCurrency(product.price)}</p>
          </div>
        );
      })}
    </div>
  );
};

export default ProductList;
