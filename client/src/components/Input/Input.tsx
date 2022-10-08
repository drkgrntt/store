import { MutableRefObject, FC, HTMLInputTypeAttribute } from "react";
import { InputValueType } from "../../hooks/useForm";
import styles from "./Input.module.scss";

interface Props {
  className?: string;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  name?: string;
  id?: string;
  label?: string;
  value?: InputValueType;
  required?: boolean;
  onChange?: Function;
  onFocus?: Function;
  onBlur?: Function;
  validation?: string;
  ref?: MutableRefObject<HTMLInputElement | HTMLTextAreaElement>;
  formState?: Record<string, any>; // ReturnType<typeof useForm>; <- Not quite type safe for some reason
}

const Input: FC<Props> = ({
  className = "",
  type = "text",
  placeholder = "",
  name = "",
  id = name,
  label = "",
  value = "",
  required = false,
  onChange = () => null,
  onFocus = () => null,
  onBlur = () => null,
  children = null,
  validation,
  formState,
  ref,
}) => {
  // Set formstate vars, but don't overwrite if passed explicitely
  if (formState) {
    if (!value) value = formState.values[name];
    if (!validation) validation = formState.errors[name];
    if (!onChange()) onChange = formState.handleChange;
    if (!onBlur()) onBlur = formState.validateField;
  }

  // Render label if present
  const renderLabel = () => {
    if (label) {
      return (
        <div className={styles.label}>
          <label htmlFor={id}>
            {label}
            {required && " *"}
          </label>
        </div>
      );
    }
  };

  // Render the input
  const renderInput = () => {
    if (type === "textarea") {
      return (
        <>
          {renderLabel()}
          <textarea
            ref={ref as MutableRefObject<HTMLTextAreaElement>}
            key={id}
            placeholder={placeholder}
            name={name}
            id={id}
            className={`${styles.textarea} ${validation && styles.invalid}`}
            value={value?.toString() || ""}
            required={!!required}
            onChange={(event) => onChange(event)}
            onBlur={(event) => onBlur(event)}
            onFocus={(event) => onFocus(event)}
          />
        </>
      );
    } else if (type === "checkbox") {
      return (
        <>
          <input
            ref={ref as MutableRefObject<HTMLInputElement>}
            key={id}
            type={type}
            placeholder={placeholder}
            name={name}
            id={id}
            className={styles.checkbox}
            checked={!!value}
            required={!!required}
            onChange={(event) => onChange(event)}
            onBlur={(event) => onBlur(event)}
            onFocus={(event) => onFocus(event)}
          />
          {renderLabel()}
        </>
      );
    }

    return (
      <>
        {renderLabel()}
        <input
          ref={ref as MutableRefObject<HTMLInputElement>}
          key={id}
          type={type}
          placeholder={placeholder}
          name={name}
          id={id}
          className={`${styles.input} ${validation && styles.invalid}`}
          value={value?.toString() || ""}
          required={!!required}
          onChange={(event) => onChange(event)}
          onBlur={(event) => onBlur(event)}
          onFocus={(event) => onFocus(event)}
        />
      </>
    );
  };

  return (
    <div className={`${styles.container} ${className || ""}`}>
      {renderInput()}
      <p className={styles.validation}>{validation}</p>
      {children}
    </div>
  );
};

export default Input;
