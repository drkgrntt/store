import { useRouter } from "next/router";
import { FC, MouseEvent } from "react";
import { useModal } from "../../hooks/useModal";
import { combineClasses } from "../../utils";
import styles from "./Modal.module.scss";

interface Props {
  name: string;
  wide?: boolean;
}

const Modal: FC<Props> = ({ name, children, wide }) => {
  const { query } = useRouter();
  const { closeModal } = useModal(name);

  const handleOutsideClick = () => {
    closeModal();
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
