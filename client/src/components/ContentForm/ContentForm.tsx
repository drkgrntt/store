import { gql, useMutation, useQuery } from "@apollo/client";
import { useRouter } from "next/router";
import { FC, FormEvent, useEffect, useState } from "react";
import { useForm } from "../../hooks/useForm";
import { useModal } from "../../hooks/useModal";
import { useUser } from "../../hooks/useUser";
import { useNotification } from "../../providers/notification";
import { Content } from "../../types/Content";
import { Category } from "../../types/Product";
import Button from "../Button";
import CategorySearch from "../CategorySearch";
import Input from "../Input";
import styles from "./ContentForm.module.scss";
import categoryStyles from "../CategorySearch/CategorySearch.module.scss";
import Selectable from "../Selectable";

interface Props {}

const CREATE_CONTENT = gql`
  mutation CreateContent($title: String, $detail: String!) {
    createContent(title: $title, detail: $detail) {
      id
      title
      detail
    }
  }
`;

const UPDATE_CONTENT = gql`
  mutation UpdateContent($id: String!, $title: String, $detail: String) {
    updateContent(id: $id, title: $title, detail: $detail) {
      id
      title
      detail
    }
  }
`;

const ATTACH_CATEGORY = gql`
  mutation AttachCategory($contentId: String!, $categoryId: String!) {
    attachCategory(contentId: $contentId, categoryId: $categoryId)
  }
`;

const DETACH_CATEGORY = gql`
  mutation DetachCategory($contentId: String!, $categoryId: String!) {
    detachCategory(contentId: $contentId, categoryId: $categoryId)
  }
`;

const CONTENT = gql`
  query Content($id: String!) {
    content(id: $id) {
      id
      title
      detail
      categories {
        id
        name
      }
    }
  }
`;

const INITIAL_STATE = {
  title: "",
  detail: "",
};

const ContentForm: FC<Props> = () => {
  const { query } = useRouter();
  const { user } = useUser();
  const { data: { content } = {} } = useQuery<{ content: Content }>(CONTENT, {
    variables: { id: query.id },
    skip: !query.id || !user?.isAdmin,
    fetchPolicy: "cache-and-network",
  });
  const formState = useForm((content as typeof INITIAL_STATE) ?? INITIAL_STATE);
  const [createContent] = useMutation(CREATE_CONTENT);
  const [updateContent] = useMutation(UPDATE_CONTENT);
  const { closeModal } = useModal();
  const { createToastNotification, createErrorNotification } =
    useNotification();
  const [attachCategory] = useMutation(ATTACH_CATEGORY);
  const [detachCategory] = useMutation(DETACH_CATEGORY);

  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    if (content?.categories) setCategories(content.categories);
  }, [content?.categories]);

  if (!user?.isAdmin) return null;

  const addCategory = (category: Category) => {
    setCategories((prev) => [...prev, category]);
  };

  const removeCategory = (category: Category) => {
    setCategories((prev) => prev.filter((c) => c.id !== category.id));
  };

  const saveCategories = async (contentId: string) => {
    await Promise.all([
      ...categories.map((category) => {
        if (!content?.categories.some((c) => c.id === category.id)) {
          attachCategory({
            variables: { categoryId: category.id, contentId },
          });
        }
      }),
      ...(content?.categories ?? []).map((category) => {
        if (!categories.some(({ id }) => category.id === id)) {
          detachCategory({ variables: { categoryId: category.id, contentId } });
        }
      }),
    ]);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { title, detail } = formState.values;
    if (content) {
      updateContent({
        variables: { id: content.id, title, detail },
        async onCompleted({ updateContent }) {
          await saveCategories(updateContent.id);
          formState.clear();
          createToastNotification({ title: "Content saved!" });
          closeModal();
        },
        onError(error) {
          createErrorNotification({
            title: "Problem saving content",
            body: error.message,
          });
        },
      });
    } else {
      createContent({
        variables: { title, detail },
        async onCompleted({ createContent }) {
          await saveCategories(createContent.id);
          formState.clear();
          createToastNotification({ title: "Content saved!" });
          closeModal();
        },
        onError(error) {
          createErrorNotification({
            title: "Problem saving content",
            body: error.message,
          });
        },
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2>Content</h2>
      <Input formState={formState} name="title" label="Title" />
      <Input
        formState={formState}
        name="detail"
        label="Details"
        type="textarea"
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
      <CategorySearch selectedCategories={categories} onClick={addCategory} />{" "}
      <Button
        type="submit"
        className={styles.submit}
        disabled={!formState.isValid}
      >
        Submit
      </Button>
    </form>
  );
};

export default ContentForm;
