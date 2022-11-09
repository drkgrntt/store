import { FC, FormEvent, MutableRefObject, ReactNode, useState } from "react";
import { combineClasses } from "../../utils";
import styles from "./Button.module.scss";

export type ClickStateRef = () => void;

interface Props {
  enableButtonRef?: MutableRefObject<ClickStateRef | undefined>;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  id?: string;
  style?: Record<string, string>;
  title?: string;
  type?: "button" | "submit" | "reset";
  children?: ReactNode;
}

const Button: FC<Props> = ({
  enableButtonRef,
  className = "",
  disabled = false,
  onClick = () => {},
  id,
  style = {},
  title,
  type = "button",
  children,
}) => {
  const [clicked, setClicked] = useState(false);
  if (enableButtonRef)
    enableButtonRef.current = () => setTimeout(() => setClicked(false));

  const handleClick = () => {
    console.log("click");
    setTimeout(() => setClicked(true));
    onClick();
  };

  return (
    <button
      disabled={disabled || (enableButtonRef && clicked)}
      onClick={handleClick}
      id={id}
      title={title}
      style={style}
      className={combineClasses(styles.button, className)}
      type={type}
    >
      {clicked && enableButtonRef ? <ButtonLoader /> : children}
    </button>
  );
};

const ButtonLoader: FC = () => {
  return (
    <div className={styles.loader}>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>
  );
};

export default Button;
