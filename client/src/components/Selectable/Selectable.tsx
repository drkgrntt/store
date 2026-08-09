import { FC, FocusEvent, MouseEvent, ReactNode } from "react";
import { combineClasses } from "../../utils";
import styles from "./Selectable.module.scss";

interface Props {
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onFocus?: (event: FocusEvent<HTMLAnchorElement>) => void;
  onBlur?: (event: FocusEvent<HTMLAnchorElement>) => void;
  children?: ReactNode;
  title?: string;
}

const Selectable: FC<Props> = ({
  children,
  className = "",
  onClick = () => null,
  onFocus = () => null,
  onBlur = () => null,
  title,
}) => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onClick(event);
  };

  return (
    <a
      onBlur={onBlur}
      onFocus={onFocus}
      onClick={handleClick}
      className={combineClasses(styles.selectable, className)}
      href="#"
      title={title}
    >
      {children}
    </a>
  );
};

export default Selectable;
