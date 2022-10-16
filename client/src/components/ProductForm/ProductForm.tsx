import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { ChangeEvent, FC, FormEvent, useState } from "react";
import { useForm } from "../../hooks/useForm";
import Button from "../Button";
import Input from "../Input";
import Image from "next/image";
import styles from "./ProductForm.module.scss";
import { useUser } from "../../hooks/useUser";
import { combineClasses } from "../../utils";

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

const IMAGE_UPLOAD_SIGNATURE = gql`
  query ImageUploadSignature {
    imageUploadSignature {
      timestamp
      signature
      cloudname
      apikey
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
  const { user } = useUser();
  const formState = useForm(INITIAL_STATE);
  const [urls, setUrls] = useState<string[]>([]);
  const [validation, setValidation] = useState("");
  const { data: { imageUrls } = {}, refetch: refetchImages } = useQuery<{
    imageUrls: string[];
  }>(IMAGE_URLS, { skip: !user?.isAdmin });
  const [createProduct] = useMutation(CREATE_PRODUCT);
  const [attachImage] = useMutation(ATTACH_IMAGE);
  const [getImageUploadSignature] = useLazyQuery(IMAGE_UPLOAD_SIGNATURE);

  if (!user?.isAdmin) return null;

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();

    const { data: { imageUploadSignature } = {} } =
      await getImageUploadSignature();

    const url =
      "https://api.cloudinary.com/v1_1/" +
      imageUploadSignature.cloudname +
      "/auto/upload";

    const files = event.target.files ?? [];
    const formData = new FormData();

    // Append parameters to the form data. The parameters that are signed using
    // the signing function (signuploadform) need to match these.
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      formData.append("file", file);
      formData.append("api_key", imageUploadSignature.apikey);
      formData.append("timestamp", imageUploadSignature.timestamp);
      formData.append("signature", imageUploadSignature.signature);
      formData.append("eager", "");
      formData.append("folder", "store");

      fetch(url, {
        method: "POST",
        body: formData,
      })
        .then((response) => response.text())
        .then((data) => {
          console.log({ data });
          refetchImages();
        })
        .catch((err) => {
          console.log({ err });
        });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
        />
        <Input
          formState={formState}
          label="Active"
          name="isActive"
          type="checkbox"
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
            <div key={url}>
              <input
                className={styles.imageCheckbox}
                type="checkbox"
                id={url}
                checked={urls.includes(url)}
                onChange={handleChange}
              />
              <label htmlFor={url}>
                <li
                  className={combineClasses(
                    styles.image,
                    urls[0] === url ? styles.primaryImage : ""
                  )}
                  key={url}
                >
                  <Image
                    src={url}
                    height={120}
                    width={120}
                    objectFit="contain"
                  />
                </li>
              </label>
            </div>
          );
        })}
      </ul>
      <input
        type="file"
        onChange={(event) =>
          handleUpload(event as ChangeEvent<HTMLInputElement>)
        }
      />
      <p>{validation}</p>
      <Button className={styles.submit} type="submit">
        Submit
      </Button>
    </form>
  );
};

export default ProductForm;
