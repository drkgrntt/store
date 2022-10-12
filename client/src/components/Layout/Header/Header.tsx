import { FC } from "react";
import styles from "./Header.module.scss";

interface Props {}

const Header: FC<Props> = () => {
  return (
    <header
      title="Small-batch colorful and quirky earrings (and a few things in between)"
      className={styles.header}
    ></header>
  );
};

export default Header;
