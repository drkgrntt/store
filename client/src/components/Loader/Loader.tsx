import { FC } from "react";
import styles from "./Loader.module.scss";

interface Props {}

const Loader: FC<Props> = () => {
  return (
    <div className={styles.loader}>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>
  );
};

export default Loader;
