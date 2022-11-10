import { FC } from "react";
import Image from "next/image";
import styles from "./Header.module.scss";

interface Props {}

const Header: FC<Props> = () => {
  return (
    <header
      title="Small-batch colorful and quirky earrings (and a few things in between)"
      className={styles.header}
    >
      <h1 className={styles.title}>
        Small-batch colorful and quirky earrings (and a few things in between)
      </h1>
      <Image
        src="/images/logo.jpg"
        height={250}
        width={250}
        alt="Site Logo"
        className={styles.logo}
      />
    </header>
  );
};

export default Header;
