import { ChangeEvent, useEffect, useState } from "react";
import { emptyValue } from "../utils";

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
    setValues((prev) => ({ ...prev, [event.target.name]: getValue(event) }));
  };

  const validateField = (event: ChangeEvent<HTMLInputElement>) => {
    const { type, required, value, name } = event.target;
    const validation = validations?.[name];

    if (required && !value) {
      setErrors((prev) => ({ ...prev, [name]: "Please complete this field." }));
    } else if (type === "email" && !emailRegex.test(value.toLowerCase())) {
      setErrors((prev) => ({
        ...prev,
        [name]: "Please use a valid email address.",
      }));
    } else if (type === "password" && value.length < 6) {
      setErrors((prev) => ({
        ...prev,
        [name]: "Please use at least 6 characters in your password.",
      }));
    } else if (validation) {
      const message = validate(getValue(event), validation, values);
      setErrors((prev) => ({ ...prev, [name]: message }));
    } else if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
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

  return {
    values,
    setValues,
    validateField,
    errors,
    handleChange,
    isValid,
    clear,
    reset,
  };
};
