import { FC, MutableRefObject, useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./Header.module.scss";
import Link from "next/link";
import { combineClasses } from "../../../utils";

interface Props {}

const Header: FC<Props> = () => {
  const headerRef = useRef<HTMLElement>();
  const [isTop, setIsTop] = useState(true);

  useEffect(() => {
    const cb = () => {
      if (!headerRef.current) return;
      const headerRect = headerRef.current.getBoundingClientRect();
      const isOutOfView = headerRect.bottom <= 300;

      if (isOutOfView && isTop) {
        setIsTop(false);
      } else if (!isOutOfView && !isTop) {
        setIsTop(true);
      }
    };

    cb();
    document.addEventListener("scroll", cb);
    return () => document.removeEventListener("scroll", cb);
  }, [headerRef.current, isTop]);

  return (
    <header
      ref={headerRef as MutableRefObject<HTMLElement>}
      title="Small-batch colorful and quirky earrings (and a few things in between)"
      className={styles.header}
    >
      <Image
        src="/images/2023christmasbanner.jpg"
        width={2000}
        height={800}
        alt="Banner image"
        className={styles.banner}
        priority
      />
      <h1 className={styles.title}>
        Small-batch colorful and quirky earrings (and a few things in between)
      </h1>
      <Link
        href="/"
        className={combineClasses(
          styles.homeImageLink,
          isTop ? "" : styles.float
        )}
      >
        <Image
          src="/images/logo.jpg"
          height={250}
          width={250}
          alt="Site Logo"
          className={styles.logo}
          priority
        />
      </Link>
    </header>
  );
};

export default Header;
