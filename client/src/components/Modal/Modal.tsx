import { useRouter } from "next/router";
import { FC, MouseEvent } from "react";
import { FaTimes } from "react-icons/fa";
import { useModal } from "../../hooks/useModal";
import { combineClasses } from "../../utils";
import Selectable from "../Selectable";
import styles from "./Modal.module.scss";

interface Props {
  name: string;
  wide?: boolean;
  className?: string;
}

const Modal: FC<Props> = ({ name, children, wide, className = "" }) => {
  const { query } = useRouter();
  const { closeModal } = useModal();

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
        <Selectable onClick={closeModal} className={styles.close}>
          <FaTimes />
        </Selectable>
        <div className={className}>{children}</div>
      </div>
    </dialog>
  );
};

export default Modal;
