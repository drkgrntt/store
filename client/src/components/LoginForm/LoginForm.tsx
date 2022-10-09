import { gql, useMutation } from "@apollo/client";
import { useRouter } from "next/router";
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
  const { query, push } = useRouter();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { email, password } = formState.values;
    login({
      variables: { email, password },
      onError(error) {
        if (error.message === "Validation error")
          error.message = "Invalid email or password";

        setValidation(error.message);
      },
      onCompleted() {
        formState.clear();
        if (query.next) push(query.next as string);
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        required
        id="login-email"
        label="Email"
        name="email"
        formState={formState}
      />
      <Input
        required
        label="Password"
        name="password"
        id="login-password"
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
