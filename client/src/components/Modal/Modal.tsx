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

  useEffect(() => {
    if (name !== query.modal) return;
    document.body.style.setProperty("overflow-y", "hidden");
    return () => document.body.style.setProperty("overflow-y", "scroll");
  }, [name, query.modal]);

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
        onMouseDown={handleInsideClick}
        className={combineClasses(styles.foreground, wide ? styles.wide : "")}
      >
        <div
          className={combineClasses(styles.container, wide ? styles.wide : "")}
        >
          <Selectable onClick={closeModal} className={styles.close}>
            <FaTimes />
          </Selectable>
          <div className={className}>{children}</div>
        </div>
      </div>
    </dialog>
  );
};

export default Modal;
