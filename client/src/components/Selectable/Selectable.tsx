import { FC, MouseEvent } from "react";
import { combineClasses } from "../../utils";
import styles from "./Selectable.module.scss";

interface Props {
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

const Selectable: FC<Props> = ({
  children,
  className = "",
  onClick = () => null,
}) => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onClick(event);
  };

  return (
    <a
      onClick={handleClick}
      className={combineClasses(styles.selectable, className)}
      href="#"
    >
      {children}
    </a>
  );
};

export default Selectable;
