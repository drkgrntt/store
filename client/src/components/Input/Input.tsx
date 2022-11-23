import {
  MutableRefObject,
  FC,
  HTMLInputTypeAttribute,
  ChangeEvent,
  ReactNode,
} from "react";
import { FaTimes } from "react-icons/fa";
import { InputValueType } from "../../hooks/useForm";
import { combineClasses } from "../../utils";
import Selectable from "../Selectable";
import styles from "./Input.module.scss";

type ElementTypes = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type ElementTypeAttributes = HTMLInputTypeAttribute | "select" | "textarea";

interface Props {
  className?: string;
  type?: ElementTypeAttributes;
  placeholder?: string;
  name?: string;
  id?: string;
  label?: string;
  disabled?: boolean;
  value?: InputValueType;
  step?: number;
  min?: number | string;
  max?: number | string;
  required?: boolean;
  options?: { value: any; text: string }[];
  onChange?: (event: ChangeEvent<ElementTypes>) => void;
  onFocus?: (event: ChangeEvent<ElementTypes>) => void;
  onBlur?: (event: ChangeEvent<ElementTypes>) => void;
  validation?: string;
  isClearable?: boolean;
  ref?: MutableRefObject<ElementTypes>;
  action?: { text: string; handler: () => void };
  children?: ReactNode;
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
  step,
  min,
  isClearable,
  max,
  options = [],
  disabled,
  required = false,
  onChange,
  onFocus = () => null,
  onBlur,
  children,
  action,
  validation,
  formState,
  ref,
}) => {
  // Set formstate vars, but don't overwrite if passed explicitely
  if (formState) {
    if (!value) value = formState.values[name];
    if (!validation) validation = formState.errors[name];
    if (!onChange) onChange = formState.handleChange;
    if (!onBlur) onBlur = formState.validateField;
  }

  // Set defaults now that they need to be set
  if (!onChange) onChange = () => null;
  if (!onBlur) onBlur = () => null;

  const handleClear = () => {
    if (formState) {
      formState.setValues((prev: Record<string, any>) => ({
        ...prev,
        [name]: "",
      }));
    } else {
      onChange?.({
        target: { name, type, value: "" },
      } as ChangeEvent<ElementTypes>);
    }
  };

  // Render label if present
  const renderLabel = () => {
    if (label) {
      return (
        <div className={styles.label}>
          <label htmlFor={id}>
            {label}
            {required && " *"}
          </label>
          {action && (
            <Selectable title="Clear" onClick={action.handler}>
              {action.text}
            </Selectable>
          )}
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
            disabled={disabled}
            className={combineClasses(
              styles.textarea,
              validation ? styles.invalid : ""
            )}
            value={value?.toString() || ""}
            required={!!required}
            onChange={onChange}
            onBlur={onBlur}
            onFocus={onFocus}
          />
        </>
      );
    } else if (type === "checkbox") {
      return (
        <div className={styles.checkboxField}>
          <input
            ref={ref as MutableRefObject<HTMLInputElement>}
            key={id}
            type={type}
            placeholder={placeholder}
            name={name}
            id={id}
            disabled={disabled}
            className={styles.checkbox}
            checked={!!value}
            required={!!required}
            onChange={onChange}
            onBlur={onBlur}
            onFocus={onFocus}
          />
          {renderLabel()}
        </div>
      );
    } else if (type === "select") {
      return (
        <>
          {renderLabel()}
          <select
            ref={ref as MutableRefObject<HTMLSelectElement>}
            disabled={disabled}
            name={name}
            id={id}
            className={combineClasses(
              styles.input,
              validation ? styles.invalid : ""
            )}
            value={value?.toString() || ""}
            required={!!required}
            onChange={onChange}
            onBlur={onBlur}
            onFocus={onFocus}
          >
            <option value="">Pick one...</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.text}
              </option>
            ))}
          </select>
        </>
      );
    }

    return (
      <>
        {renderLabel()}
        <div className={styles.inputWrapper}>
          <input
            ref={ref as MutableRefObject<HTMLInputElement>}
            key={id}
            type={type}
            placeholder={placeholder}
            name={name}
            step={step}
            min={min}
            max={max}
            id={id}
            disabled={disabled}
            className={combineClasses(
              styles.input,
              validation ? styles.invalid : ""
            )}
            value={
              type === "date"
                ? (value as Date)?.toISOString().split("T")[0]
                : value?.toString() || ""
            }
            required={!!required}
            onChange={onChange}
            onBlur={onBlur}
            onFocus={onFocus}
            list={options ? `${id}-options` : undefined}
          />

          {options && (
            <datalist id={`${id}-options`}>
              {options.map((option) => (
                <option
                  key={option.value}
                  value={option.text}
                  onClick={(e) => console.log(e)}
                />
              ))}
            </datalist>
          )}

          {isClearable && (
            <Selectable className={styles.clear} onClick={handleClear}>
              <FaTimes />
            </Selectable>
          )}
        </div>
      </>
    );
  };

  return (
    <div className={combineClasses(styles.container, className)}>
      {renderInput()}
      <p className={styles.validation}>{validation}</p>
      {children}
    </div>
  );
};

export default Input;
