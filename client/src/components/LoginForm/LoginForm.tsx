import { FC, FormEvent } from "react";
import { useForm } from "../../hooks/useForm";
import Button from "../Button";
import Input from "../Input";

const INITIAL_STATE = {
  email: "",
  password: "",
};

const LoginForm: FC = () => {
  const formState = useForm(INITIAL_STATE);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(formState);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input required label="Email" name="email" formState={formState} />
      <Input
        required
        label="Password"
        name="password"
        type="password"
        formState={formState}
      />
      <Button type="submit" disabled={!formState.isValid}>
        Login
      </Button>
    </form>
  );
};

export default LoginForm;
