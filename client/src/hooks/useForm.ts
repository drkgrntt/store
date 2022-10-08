import { ChangeEvent, useState } from "react";

export type InputValueType = string | number | Date | boolean | null;

export type Validation = {
  message: string;
  test: (value: InputValueType) => boolean;
};
export type Validations = Record<string, Validation>;

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

export const emailRegex =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const useForm = <FormState extends Record<string, InputValueType>>(
  initialState: FormState,
  validations?: Partial<Record<keyof FormState, Validation>>
) => {
  const initialErrors: Partial<Record<keyof FormState, string>> = {};

  const [values, setValues] = useState(initialState);
  const [errors, setErrors] = useState(initialErrors);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValues({ ...values, [event.target.name]: getValue(event) });
  };

  const validateField = (event: ChangeEvent<HTMLInputElement>) => {
    const { type, required, value, name } = event.target;
    const validation = validations?.[name];

    if (required && !value) {
      setErrors({ ...errors, [name]: "Please complete this field." });
    } else if (type === "email" && !emailRegex.test(value.toLowerCase())) {
      setErrors({
        ...errors,
        [name]: "Please use a valid email address.",
      });
    } else if (type === "password" && value.length < 6) {
      setErrors({
        ...errors,
        [name]: "Please use at least 6 characters in your password.",
      });
    } else if (validation) {
      const isValid = validation.test(getValue(event));
      setErrors({ ...errors, [name]: isValid ? "" : validation.message });
    } else if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  return {
    values,
    setValues,
    validateField,
    errors,
    handleChange,
  };
};
