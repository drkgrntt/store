import { useRouter } from "next/router";
import { ParsedUrlQuery } from "querystring";
import { FC, MouseEvent } from "react";
import { combineClasses } from "../../utils";
import styles from "./Modal.module.scss";

interface Props {
  name: string;
  wide?: boolean;
}

const Modal: FC<Props> = ({ name, children, wide }) => {
  const { query, push } = useRouter();

  const handleOutsideClick = () => {
    const queryWithoutModal = Object.entries(query).reduce(
      (current, [key, value]) => {
        if (key !== "modal") {
          current[key] = value;
        }
        return current;
      },
      {} as ParsedUrlQuery
    );
    push({ query: queryWithoutModal });
  };

  const handleInsideClick = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <dialog
      className={styles.background}
      open={query.modal === name}
      onClick={handleOutsideClick}
    >
      <div
        className={combineClasses(styles.container, wide ? styles.wide : "")}
        onClick={handleInsideClick}
      >
        {children}
      </div>
    </dialog>
  );
};

export default Modal;
