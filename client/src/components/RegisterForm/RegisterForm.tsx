import { gql, useMutation } from "@apollo/client";
import { useRouter } from "next/router";
import { FC, FormEvent, useState } from "react";
import { useForm, Validations } from "../../hooks/useForm";
import { useUser } from "../../hooks/useUser";
import { User } from "../../types/User";
import Button from "../Button";
import Input from "../Input";

const REGISTER = gql`
  mutation Register($email: String!, $password: String!) {
    register(email: $email, password: $password) {
      id
      email
      isAdmin
      createdAt
      updatedAt
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
  passwordVerify: "",
};

const VALIDATIONS: Validations<typeof INITIAL_STATE> = {
  passwordVerify: {
    message: "Please make sure this matches what you set as your password.",
    test: (value, values) => values.password === value,
  },
};

const RegisterForm: FC = () => {
  const formState = useForm(INITIAL_STATE, VALIDATIONS);
  const [register] = useMutation<{ register: User }>(REGISTER);
  const [validation, setValidation] = useState("");
  const { query, push } = useRouter();
  const { refetch } = useUser();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { email, password } = formState.values;
    register({
      variables: { email, password },
      onError(error) {
        if (error.message === "Validation error")
          error.message = "Invalid email or password";
        setValidation(error.message);
      },
      async onCompleted() {
        formState.clear();
        await refetch();
        push((query.next as string) ?? "/");
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        required
        id="register-email"
        label="Email"
        name="email"
        formState={formState}
      />
      <Input
        required
        id="register-password"
        label="Password"
        name="password"
        type="password"
        formState={formState}
      />
      <Input
        required
        label="Verify Password"
        name="passwordVerify"
        type="password"
        formState={formState}
      />
      <p>{validation}</p>
      <Button type="submit" disabled={!formState.isValid}>
        Sign Up
      </Button>
    </form>
  );
};

export default RegisterForm;
