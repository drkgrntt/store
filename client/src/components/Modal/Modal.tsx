import { useRouter } from "next/router";
import { ReactNode, useEffect } from "react";
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
  children?: ReactNode;
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

  if (query.modal !== name) return null;

  return (
    <dialog
      className={styles.background}
      open={query.modal === name}
      onMouseDown={handleOutsideClick}
    >
      <div
        className={combineClasses(styles.container, wide ? styles.wide : "")}
        onMouseDown={handleInsideClick}
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
