import { gql, useMutation, useQuery } from "@apollo/client";
import { ChangeEvent, FC, FormEvent, useState } from "react";
import { useForm } from "../../hooks/useForm";
import Button from "../Button";
import Input from "../Input";
import Image from "next/image";
import styles from "./ProductForm.module.scss";

interface Props {
  onSuccess?: () => void;
}

const CREATE_PRODUCT = gql`
  mutation CreateProduct(
    $isActive: Boolean!
    $isMadeToOrder: Boolean!
    $quantity: Float!
    $price: Float!
    $description: String!
    $title: String!
  ) {
    createProduct(
      isActive: $isActive
      isMadeToOrder: $isMadeToOrder
      quantity: $quantity
      price: $price
      description: $description
      title: $title
    ) {
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
`;

const UPDATE_PRODUCT = gql`
  mutation UpdateProduct(
    $productId: String!
    $isActive: Boolean
    $isMadeToOrder: Boolean
    $quantity: Float
    $price: Float
    $description: String
    $title: String
  ) {
    updateProduct(
      id: $productId
      isActive: $isActive
      isMadeToOrder: $isMadeToOrder
      quantity: $quantity
      price: $price
      description: $description
      title: $title
    ) {
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
`;

const IMAGE_URLS = gql`
  query ImageUrls {
    imageUrls
  }
`;

const ATTACH_IMAGE = gql`
  mutation AttachImage($primary: Boolean!, $url: String!, $productId: String!) {
    attachImage(primary: $primary, url: $url, productId: $productId) {
      id
      url
      title
      description
      primary
      createdAt
      updatedAt
    }
  }
`;

const INITIAL_STATE = {
  title: "",
  description: "",
  price: 0,
  quantity: 0,
  isMadeToOrder: false,
  isActive: false,
};

const ProductForm: FC<Props> = ({ onSuccess = () => {} }) => {
  const formState = useForm(INITIAL_STATE);
  const [urls, setUrls] = useState<string[]>([]);
  const [validation, setValidation] = useState("");
  const { data: { imageUrls } = {} } = useQuery<{ imageUrls: string[] }>(
    IMAGE_URLS
  );
  const [createProduct] = useMutation(CREATE_PRODUCT);
  const [attachImage] = useMutation(ATTACH_IMAGE);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { title, description, price, quantity, isMadeToOrder, isActive } =
      formState.values;

    createProduct({
      variables: {
        title,
        description,
        price: price * 100,
        quantity,
        isMadeToOrder,
        isActive,
      },
      async onCompleted({ createProduct }) {
        await Promise.all(
          urls.map((url, i) =>
            attachImage({
              variables: { url, productId: createProduct.id, primary: !i },
            })
          )
        );
        formState.clear();
        onSuccess();
      },
      onError(error) {
        setValidation(error.message);
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2 className={styles.header}>Create a new product</h2>
      <Input formState={formState} label="Title" name="title" required />
      <Input
        formState={formState}
        label="Description"
        name="description"
        required
      />
      <div className={styles.row}>
        <Input
          formState={formState}
          label="Price"
          name="price"
          type="number"
          step={0.01}
          required
          min={0}
        />
        <Input
          formState={formState}
          label="Quantity"
          name="quantity"
          type="number"
          required
          step={1}
          min={0}
        />
      </div>
      <div className={styles.row}>
        <Input
          formState={formState}
          label="Made to order"
          name="isMadeToOrder"
          type="checkbox"
          required
        />
        <Input
          formState={formState}
          label="Active"
          name="isActive"
          type="checkbox"
          required
        />
      </div>
      <ul className={styles.images}>
        {imageUrls?.map((url) => {
          const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
            setUrls((prev) => {
              if (event.target.checked) {
                return [...prev, url];
              } else {
                return prev.filter((u) => u !== url);
              }
            });
          };
          return (
            <>
              <input
                className={styles.imageCheckbox}
                type="checkbox"
                id={url}
                checked={urls.includes(url)}
                onChange={handleChange}
              />
              <label htmlFor={url}>
                <li className={styles.image} key={url}>
                  <Image
                    src={url}
                    height={120}
                    width={120}
                    objectFit="contain"
                  />
                </li>
              </label>
            </>
          );
        })}
      </ul>
      <p>{validation}</p>
      <Button className={styles.submit} type="submit">
        Submit
      </Button>
    </form>
  );
};

export default ProductForm;
