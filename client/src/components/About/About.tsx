import { gql, useQuery } from "@apollo/client";
import Image from "next/image";
import { FC } from "react";
import { Content } from "../../types/Content";
import Loader from "../Loader";
import styles from "./About.module.scss";

interface Props { }

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

const About: FC<Props> = () => {
  const { data: { contents = [] } = {} } = useQuery<{ contents: Content[] }>(
    CONTENTS,
    {
      variables: { search: "About the Maker" },
      fetchPolicy: "cache-and-network",
    }
  );
  const [content] = contents;

  if (!content) return <Loader />;

  return (
    <div>
      <h2>{content.title}</h2>
      <Image
        height={500}
        width={500}
        className={styles.image}
        alt="Ceanne"
        src="/images/ceanne-headshot-2025.jpg"
      />
      <div className={styles.body}>{content.detail}</div>
    </div>
  );
};

export default About;
