import { FC } from "react";
import styles from "./Footer.module.scss";

interface Props {}

const Footer: FC<Props> = () => {
  return (
    <footer className={styles.footer}>
      <a
        className={styles.link}
        href="https://derekgarnett.com"
        target="_blank"
      >
        Site by Derek Garnett
      </a>
    </footer>
  );
};

export default Footer;
