import {
  ChangeEvent,
  MutableRefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { emptyValue, range } from "../utils";

export type InputValueType =
  | string
  | number
  | Date
  | boolean
  | null
  | undefined;

export type Validation<FormValues> = {
  message: string;
  test: (value: InputValueType, formValues: FormValues) => boolean;
};
export type Validations<FormValues> = Record<
  string,
  Validation<FormValues> | Validation<FormValues>[]
>;

export const getValue = (
  event: ChangeEvent<HTMLInputElement>
): InputValueType => {
  const { type, value, checked, valueAsDate, valueAsNumber } = event.target;

  switch (type?.toLowerCase()) {
    case "checkbox":
      return checked;
    case "date":
      return valueAsDate;
    case "number":
      return valueAsNumber;
    case "text":
    case "password":
    case "email":
    default:
      return value;
  }
};

export const validate = <FormValues>(
  value: InputValueType,
  validations: Validation<FormValues> | Validation<FormValues>[],
  values: FormValues
): string => {
  if (!Array.isArray(validations)) {
    validations = [validations];
  }

  for (const validation of validations) {
    const isValid = validation.test(value, values);
    if (!isValid) return validation.message;
  }
  return "";
};

export const emailRegex =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const useForm = <FormState extends Record<string, InputValueType>>(
  initialState: FormState,
  validations?: Partial<Validations<FormState>>
) => {
  const initialErrors: Partial<Record<keyof FormState, string>> = {};

  const [values, setValues] = useState(initialState);
  const [errors, setErrors] = useState(initialErrors);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (errors[event.target.name]) {
      validateField(event);
    }
    setValues((prev) => ({ ...prev, [event.target.name]: getValue(event) }));
  };

  const validateField = (event: ChangeEvent<HTMLInputElement>): boolean => {
    const { type, required, value, name } = event.target;
    const validation = validations?.[name];

    if (required && !value) {
      setErrors((prev) => ({ ...prev, [name]: "Please complete this field." }));
      return false;
    } else if (type === "email" && !emailRegex.test(value.toLowerCase())) {
      setErrors((prev) => ({
        ...prev,
        [name]: "Please use a valid email address.",
      }));
      return false;
    } else if (type === "password" && value.length < 6) {
      setErrors((prev) => ({
        ...prev,
        [name]: "Please use at least 6 characters in your password.",
      }));
      return false;
    } else if (validation) {
      const message = validate(getValue(event), validation, values);
      setErrors((prev) => ({ ...prev, [name]: message }));
      return !!message;
    } else if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }

    return true;
  };

  const isValid = !Object.values(errors).filter(Boolean).length;

  const clear = () => {
    setValues((prev) => {
      return Object.keys(prev).reduce((current, key) => {
        return { ...current, [key]: emptyValue(prev[key]) };
      }, {} as typeof prev);
    });
    setErrors({});
  };

  const reset = () => {
    setValues(initialState);
    setErrors(initialErrors);
  };

  useEffect(reset, [initialState]);

  const formRef =
    useRef<HTMLFormElement>() as MutableRefObject<HTMLFormElement | null>;

  const validateForm = (): boolean => {
    const elements = formRef.current?.elements;
    if (!elements) return false;

    let isValid = true;

    for (const i of range(elements.length)) {
      const element = elements[i] as HTMLInputElement;
      if (element.name in values) {
        const fieldIsValid = validateField({
          target: element,
        } as ChangeEvent<HTMLInputElement>);
        if (!fieldIsValid) isValid = false;
      }
    }

    return isValid;
  };

  return {
    values,
    setValues,
    validateField,
    errors,
    handleChange,
    isValid,
    clear,
    reset,
    formRef,
    validate: validateForm,
  };
};
