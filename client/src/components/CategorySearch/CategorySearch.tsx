import { gql, useLazyQuery, useMutation } from "@apollo/client";
import { FC, useEffect } from "react";
import { useDebounce } from "../../hooks/useDebounce";
import { useForm } from "../../hooks/useForm";
import { Category } from "../../types/Product";
import Input from "../Input";
import Selectable from "../Selectable";
import styles from "./CategorySearch.module.scss";

interface Props {
  selectedCategories?: Category[];
  onClick: (category: Category) => void;
}

const CATEGORIES = gql`
  query Categories($search: String!) {
    categories(search: $search) {
      id
      name
      createdAt
      updatedAt
    }
  }
`;

const CREATE_CATEGORY = gql`
  mutation CreateCategory($name: String!) {
    createCategory(name: $name) {
      id
      name
      createdAt
      updatedAt
    }
  }
`;

const INITIAL_STATE = { search: "" };

const CategorySearch: FC<Props> = ({ selectedCategories, onClick }) => {
  const formState = useForm(INITIAL_STATE);
  const [search, { data: { categories: foundCategories = [] } = {} }] =
    useLazyQuery<{
      categories: Category[];
    }>(CATEGORIES);
  const [createCategory] = useMutation(CREATE_CATEGORY);
  const debouncedSearch = useDebounce(search, 500);

  useEffect(() => {
    if (!formState.values.search) return;
    debouncedSearch({ variables: { search: formState.values.search } });
  }, [formState.values.search]);

  const handleAddNew = () => {
    createCategory({
      variables: { name: formState.values.search },
      onCompleted({ createCategory }) {
        onClick(createCategory);
        formState.clear();
      },
    });
  };

  return (
    <div>
      <Input name="search" label="Search" formState={formState} />
      <ul className={styles.categories}>
        {foundCategories
          .filter(
            (category) => !selectedCategories?.some((c) => c.id === category.id)
          )
          .map((category) => (
            <li key={category.id} className={styles.category}>
              <Selectable
                className={styles.text}
                onClick={() => onClick(category)}
              >
                {category.name}
              </Selectable>
            </li>
          ))}
        {formState.values.search &&
          !foundCategories.some(
            (category) =>
              category.name.toLowerCase() ===
              formState.values.search.toLowerCase()
          ) && (
            <li className={styles.category}>
              <Selectable className={styles.text} onClick={handleAddNew}>
                Add new ({formState.values.search})
              </Selectable>
            </li>
          )}
      </ul>
    </div>
  );
};

export default CategorySearch;
