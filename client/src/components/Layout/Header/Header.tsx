import { FC } from "react";
import Image from "next/image";
import styles from "./Header.module.scss";
import Link from "next/link";

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
      <Link href="/" className={styles.homeImageLink}>
        <Image
          src="/images/logo.jpg"
          height={250}
          width={250}
          alt="Site Logo"
          className={styles.logo}
        />
      </Link>
    </header>
  );
};

export default Header;
