import { FC } from "react";
import { combineClasses } from "../../utils";
import styles from "./Button.module.scss";

interface Props {
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  id?: string;
  style?: Record<string, string>;
  title?: string;
  type?: "button" | "submit" | "reset";
}

const Button: FC<Props> = ({
  className = "",
  disabled = false,
  onClick = () => {},
  id,
  style = {},
  title = "",
  type = "button",
  children,
}) => {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      id={id}
      title={title}
      style={style}
      className={combineClasses(styles.button, className)}
      type={type}
    >
      {children}
    </button>
  );
};

export default Button;
