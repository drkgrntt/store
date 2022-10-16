import { FC, FocusEvent, MouseEvent } from "react";
import { combineClasses } from "../../utils";
import styles from "./Selectable.module.scss";

interface Props {
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onFocus?: (event: FocusEvent<HTMLAnchorElement>) => void;
  onBlur?: (event: FocusEvent<HTMLAnchorElement>) => void;
}

const Selectable: FC<Props> = ({
  children,
  className = "",
  onClick = () => null,
  onFocus = () => null,
  onBlur = () => null,
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
    >
      {children}
    </a>
  );
};

export default Selectable;
