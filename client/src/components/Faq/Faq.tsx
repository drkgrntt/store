import { gql, useQuery } from "@apollo/client";
import { FC } from "react";
import { Content } from "../../types/Content";
import Loader from "../Loader";
import styles from "./Faq.module.scss";

interface Props {}

const CONTENTS = gql`
  query Contents($search: String) {
    contents(search: $search) {
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

const Faq: FC<Props> = () => {
  const { data: { contents = [] } = {} } = useQuery<{ contents: Content[] }>(
    CONTENTS,
    {
      variables: { search: "FAQ" },
    }
  );

  if (!contents.length) return <Loader />;

  return (
    <div>
      <h2>FAQ</h2>
      {contents.map((content) => (
        <div key={content.id}>
          <h3>{content.title}</h3>
          <div className={styles.body}>{content.detail}</div>
        </div>
      ))}
    </div>
  );
};

export default Faq;
