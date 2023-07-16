import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import {
  ChangeEvent,
  FC,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useForm } from "../../hooks/useForm";
import Button, { ClickStateRef } from "../Button";
import Input from "../Input";
import Image from "next/image";
import { useUser } from "../../hooks/useUser";
import { combineClasses } from "../../utils";
import { useRouter } from "next/router";
import { Category, Product } from "../../types/Product";
import { useNotification } from "../../providers/notification";
import CategorySearch from "../CategorySearch";
import Selectable from "../Selectable";
import styles from "./ProductForm.module.scss";
import categoryStyles from "../CategorySearch/CategorySearch.module.scss";
import Loader from "../Loader";
import { FaTimes } from "react-icons/fa";

interface Props {
  onSuccess?: () => void;
}

const IMAGE_URLS = gql`
  query ImageUrls {
    imageUrls
  }
`;

const IMAGES = gql`
  query Images {
    images {
      id
      url
    }
  }
`;

const PRODUCT = gql`
  query GetProduct($productId: String!) {
    product(id: $productId) {
      id
      title
      description
      price
      quantity
      isMadeToOrder
      isActive
      createdAt
      updatedAt
      categories {
        id
        name
        createdAt
        updatedAt
      }
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
    $id: String!
    $isActive: Boolean
    $isMadeToOrder: Boolean
    $quantity: Float
    $price: Float
    $description: String
    $title: String
  ) {
    updateProduct(
      id: $id
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

const DETACH_IMAGE = gql`
  mutation DetachImage($imageId: String!) {
    detachImage(id: $imageId)
  }
`;

const DELETE_IMAGE = gql`
  mutation DeleteImage($id: String!) {
    deleteImage(id: $id)
  }
`;

const ATTACH_CATEGORY = gql`
  mutation AttachCategory($productId: String!, $categoryId: String!) {
    attachCategory(productId: $productId, categoryId: $categoryId)
  }
`;

const DETACH_CATEGORY = gql`
  mutation DetachCategory($productId: String!, $categoryId: String!) {
    detachCategory(productId: $productId, categoryId: $categoryId)
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
  const { query } = useRouter();
  const {
    data: { images } = {},
    refetch: refetchImages,
    loading: loadingImages,
  } = useQuery<{
    images: { id: string; url: string }[];
  }>(IMAGES, { skip: !user?.isAdmin, fetchPolicy: "cache-and-network" });
  const { data: { product } = {} } = useQuery<{ product: Product }>(PRODUCT, {
    variables: { productId: query.id },
    skip: !query.id || !user?.isAdmin,
    fetchPolicy: "cache-and-network",
  });
  const formProduct = useMemo(() => {
    if (product) {
      return {
        ...product,
        price: product.price / 100,
      };
    }
  }, [product]);
  const enableButtonRef = useRef<ClickStateRef>();

  const [createProduct] = useMutation(CREATE_PRODUCT);
  const [updateProduct] = useMutation(UPDATE_PRODUCT);
  const [attachImage] = useMutation(ATTACH_IMAGE);
  const [detachImage] = useMutation(DETACH_IMAGE);
  const [getImageUploadSignature] = useLazyQuery(IMAGE_UPLOAD_SIGNATURE);
  const [deleteImage] = useMutation(DELETE_IMAGE);
  const [attachCategory] = useMutation(ATTACH_CATEGORY);
  const [detachCategory] = useMutation(DETACH_CATEGORY);

  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    if (product?.categories) setCategories(product.categories);
  }, [product?.categories]);

  const formState = useForm(
    (formProduct as typeof INITIAL_STATE) ?? INITIAL_STATE
  );
  const [urls, setUrls] = useState<string[]>([]);
  const { createToastNotification, createErrorNotification } =
    useNotification();

  useEffect(() => {
    const primary = product?.images.find((image) => image.primary);
    const productUrls = [
      ...new Set([
        primary?.url,
        ...(product?.images.map((image) => image.url) ?? []),
      ]),
    ].filter(Boolean);
    setUrls(productUrls as string[]);
  }, [product]);

  if (!user?.isAdmin) return null;

  const addCategory = (category: Category) => {
    setCategories((prev) => [...prev, category]);
  };

  const removeCategory = (category: Category) => {
    setCategories((prev) => prev.filter((c) => c.id !== category.id));
  };

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
        .then((response) => response.json())
        .then((data) => {
          setUrls((prev) => [...prev, data.url]);
          refetchImages();
        })
        .catch((err) => {
          console.log({ err });
        });
    }
  };

  const saveImages = async (productId: string) => {
    await Promise.all([
      ...urls.map((url, i) => {
        if (!product?.images.some((image) => image.url === url)) {
          attachImage({
            variables: { url, productId, primary: !i },
          });
        }
      }),
      ...(product?.images ?? []).map((image) => {
        if (!urls.some((url) => image.url === url)) {
          detachImage({ variables: { imageId: image.id } });
        }
      }),
    ]);
  };

  const saveCategories = async (productId: string) => {
    await Promise.all([
      ...categories.map((category) => {
        if (!product?.categories.some((c) => c.id === category.id)) {
          attachCategory({
            variables: { categoryId: category.id, productId },
          });
        }
      }),
      ...(product?.categories ?? []).map((category) => {
        if (!categories.some(({ id }) => category.id === id)) {
          detachCategory({ variables: { categoryId: category.id, productId } });
        }
      }),
    ]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = formState.validate();
    if (!isValid) {
      enableButtonRef.current?.();
      return;
    }

    const { title, description, price, quantity, isMadeToOrder, isActive } =
      formState.values;

    if (product) {
      updateProduct({
        variables: {
          id: product.id,
          title,
          description,
          price: price * 100,
          quantity,
          isMadeToOrder,
          isActive,
        },
        async onCompleted({ updateProduct }) {
          await saveImages(updateProduct.id);
          await saveCategories(updateProduct.id);
          formState.clear();
          onSuccess();
          enableButtonRef.current?.();
          createToastNotification({
            title: "Success!",
            body: `${updateProduct.title} updated`,
            icon: urls[0],
          });
        },
        onError(error) {
          createErrorNotification({ title: "Error", body: error.message });
        },
      });
    } else {
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
          await saveImages(createProduct.id);
          await saveCategories(createProduct.id);
          formState.clear();
          enableButtonRef.current?.();
          onSuccess();
          createToastNotification({
            title: "Success!",
            body: `${createProduct.title} created`,
            icon: urls[0],
          });
        },
        onError(error) {
          createErrorNotification({ title: "Error", body: error.message });
          enableButtonRef.current?.();
        },
      });
    }
  };

  const handleDeleteImage = (imageId: string) => {
    const confirm = window.confirm(
      "Are you sure you want to delete this image?"
    );
    if (!confirm) return;

    deleteImage({
      variables: { id: imageId },
      onCompleted() {
        createToastNotification({ title: "Image successfully deleted" });
        refetchImages();
      },
      onError(err) {
        createErrorNotification({
          title: "Error deleting the image",
          body: err.message,
        });
      },
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={styles.form}
      noValidate
      ref={formState.formRef}
    >
      <h2 className={styles.header}>
        {product ? "Update a product" : "Create a new product"}
      </h2>
      <Input formState={formState} label="Title" name="title" required />
      <Input
        formState={formState}
        label="Description"
        name="description"
        required
        type="textarea"
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
        {loadingImages && <Loader />}
        {!loadingImages &&
          [
            ...(product?.images.map((image) => ({
              url: image.url,
              id: null,
            })) ?? []),
            ...(images ?? []),
          ].map(({ id, url }) => {
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
                    {id && (
                      <Selectable
                        onClick={() => handleDeleteImage(id)}
                        className={styles.deleteImage}
                      >
                        <FaTimes />
                      </Selectable>
                    )}
                    <Image
                      alt="An image from the store folder of your Cloudinary account."
                      src={url}
                      height={120}
                      width={120}
                      className={styles.image}
                    />
                  </li>
                </label>
              </div>
            );
          })}
      </ul>
      <label htmlFor="file-input">Add new image</label>
      <input
        type="file"
        id="file-input"
        onChange={(event) =>
          handleUpload(event as ChangeEvent<HTMLInputElement>)
        }
      />
      <h3 className={styles.categoryTitle}>Categories</h3>
      {!!categories.length && (
        <ul className={categoryStyles.categories}>
          {categories.map((category) => (
            <li className={categoryStyles.category} key={category.id}>
              <Selectable
                className={categoryStyles.text}
                onClick={() => removeCategory(category)}
              >
                {category.name}
              </Selectable>
            </li>
          ))}
        </ul>
      )}
      <CategorySearch selectedCategories={categories} onClick={addCategory} />
      <Button
        enableButtonRef={enableButtonRef}
        className={styles.submit}
        type="submit"
        disabled={!formState.isValid}
      >
        Submit
      </Button>
    </form>
  );
};

export default ProductForm;
