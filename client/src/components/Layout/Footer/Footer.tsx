import { FC } from "react";
import Image from "next/image";
import styles from "./Footer.module.scss";
import { FaFacebook, FaInstagram } from "react-icons/fa";

interface Props {}

const Footer: FC<Props> = () => {
  return (
    <footer className={styles.footer}>
      <Image
        src="/images/logo.jpg"
        height={200}
        width={200}
        alt="Site Logo"
        className={styles.logo}
      />

      <div className={styles.icons}>
        <a
          target="_blank"
          rel="noreferrer"
          className={styles.icon}
          href="https://www.facebook.com/groups/364587012533674/?ref=share_group_link"
        >
          <FaFacebook />
        </a>
        <a
          target="_blank"
          rel="noreferrer"
          className={styles.icon}
          href="https://www.instagram.com/shopmidwestdaisy"
        >
          <FaInstagram />
        </a>
      </div>

      <div className={styles.texts}>
        <a
          className={styles.link}
          href="https://derekgarnett.com"
          target="_blank"
          rel="noreferrer"
        >
          Site by Derek Garnett
        </a>
      </div>
    </footer>
  );
};

export default Footer;
