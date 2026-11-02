import { gql, useMutation, useQuery } from "@apollo/client";
import { FC, useState } from "react";
import { useNotification } from "../../providers/notification";
import { Category } from "../../types/Product";
import Button from "../Button";
import Input from "../Input";
import styles from "./SeasonalFeatures.module.scss";

const CATEGORIES = gql`
  query SeasonalFeatureCategories {
    categories {
      id
      name
    }
  }
`;

const CLEAR_FEATURES = gql`
  mutation ClearFeatures($tag: String) {
    clearFeatures(tag: $tag)
  }
`;

const FEATURE_PRODUCTS = gql`
  mutation FeatureProducts($tag: String!) {
    featureProducts(tag: $tag)
  }
`;

const SeasonalFeatures: FC = () => {
  const { data: { categories = [] } = {} } = useQuery<{
    categories: Category[];
  }>(CATEGORIES);
  const [clearFeatures] = useMutation(CLEAR_FEATURES, {
    refetchQueries: ["Products"],
  });
  const [featureProducts] = useMutation(FEATURE_PRODUCTS, {
    refetchQueries: ["Products"],
  });
  const { createToastNotification, createErrorNotification } =
    useNotification();

  const tagOptions = categories
    .filter((category) => category.name !== "Feature")
    .map((category) => ({ value: category.name, text: category.name }));

  const [clearTag, setClearTag] = useState("");
  const [featureTag, setFeatureTag] = useState("");

  const handleClear = async () => {
    const label = clearTag ? `"${clearTag}"` : "ALL";
    if (!confirm(`De-feature ${label} featured products?`)) return;
    try {
      await clearFeatures({ variables: { tag: clearTag || null } });
      createToastNotification({ title: `De-featured ${label} products` });
    } catch (e) {
      createErrorNotification({ title: (e as Error).message });
    }
  };

  const handleFeature = async () => {
    if (!featureTag) return;
    try {
      const { data } = await featureProducts({
        variables: { tag: featureTag },
      });
      createToastNotification({
        title: `Featured ${data.featureProducts} products`,
      });
    } catch (e) {
      createErrorNotification({ title: (e as Error).message });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <Input
          className={styles.input}
          type="select"
          name="clearTag"
          placeholder="All featured products"
          options={tagOptions}
          value={clearTag}
          onChange={(e) => setClearTag(e.target.value)}
        />
        <Button onClick={handleClear}>De-feature</Button>
      </div>
      <div className={styles.row}>
        <Input
          className={styles.input}
          type="select"
          name="featureTag"
          placeholder="Pick a tag to feature..."
          options={tagOptions}
          value={featureTag}
          onChange={(e) => setFeatureTag(e.target.value)}
        />
        <Button onClick={handleFeature} disabled={!featureTag}>
          Feature
        </Button>
      </div>
    </div>
  );
};

export default SeasonalFeatures;
