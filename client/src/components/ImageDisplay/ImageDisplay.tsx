import { useRouter } from "next/router";
import { FC } from "react";
import Image from "next/image";
import styles from "./ImageDisplay.module.scss";
import { FaExternalLinkAlt } from "react-icons/fa";
import Link from "next/link";

interface Props {}

const ImageDisplay: FC<Props> = () => {
  const { query } = useRouter();

  return (
    <div className={styles.container}>
      <Link target="_blank" rel="noreferrer" href={query.src as string}>
        <FaExternalLinkAlt className={styles.icon} />
      </Link>
      <Image
        src={query.src as string}
        alt={query.alt as string}
        height={600}
        width={1200}
        className={styles.image}
      />
    </div>
  );
};

export default ImageDisplay;
