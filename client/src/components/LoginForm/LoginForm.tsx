import { gql, useMutation } from "@apollo/client";
import { FC, FormEvent, useState } from "react";
import { useForm } from "../../hooks/useForm";
import { User } from "../../types/User";
import Button from "../Button";
import Input from "../Input";

const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      id
      email
      isAdmin
      tokens {
        id
        value
        userId
        createdAt
        updatedAt
      }
    }
  }
`;

const INITIAL_STATE = {
  email: "",
  password: "",
};

const LoginForm: FC = () => {
  const formState = useForm(INITIAL_STATE);
  const [login] = useMutation<{ login: User }>(LOGIN);
  const [validation, setValidation] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { email, password } = formState.values;
    login({
      variables: { email, password },
      onError(error) {
        setValidation(error.message);
      },
      onCompleted() {
        formState.clear();
      },
    });
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
      <p>{validation}</p>
      <Button type="submit" disabled={!formState.isValid}>
        Login
      </Button>
    </form>
  );
};

export default LoginForm;
