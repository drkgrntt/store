import { FC } from "react";
import { useForm, Validations } from "../../hooks/useForm";
import Input from "../Input";

const INITIAL_STATE = {
  email: "",
  password: "",
};

const validations: Validations = {
  email: {
    test: (value) => (value as string).includes("h"),
    message: 'Email must contain an "h"',
  },
};

const LoginForm: FC = () => {
  const formState = useForm(INITIAL_STATE, validations);

  return (
    <form>
      <Input required label="Email" name="email" formState={formState} />
      <Input
        required
        label="Password"
        name="password"
        type="password"
        formState={formState}
      />
    </form>
  );
};

export default LoginForm;
