import { gql, useMutation } from "@apollo/client";
import Link from "next/link";
import { useRouter } from "next/router";
import { FC, FormEvent, useState } from "react";
import { useForm } from "../../hooks/useForm";
import { useModal } from "../../hooks/useModal";
import { useUser } from "../../hooks/useUser";
import { useNotification } from "../../providers/notification";
import { User } from "../../types/User";
import Button from "../Button";
import Input from "../Input";
import styles from "./LoginForm.module.scss";

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
  const { query, push } = useRouter();
  const { refetch } = useUser();
  const { modalHref } = useModal();
  const { createErrorNotification, createToastNotification } =
    useNotification();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const isValid = formState.validate();
    if (!isValid) {
      return;
    }

    const { email, password } = formState.values;
    login({
      variables: { email, password },
      onError(error) {
        if (error.message === "Validation error")
          error.message = "Invalid email or password";

        createErrorNotification({ title: "Login error", body: error.message });
      },
      async onCompleted({ login }) {
        formState.clear();
        await refetch();
        createToastNotification({
          title: "Logged in",
          body: `Logged in as ${login?.email}`,
        });
        push((query.next as string) ?? "/");
      },
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={styles.form}
      ref={formState.formRef}
    >
      <h2>Login</h2>
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
      <Link
        href={modalHref("forgot-password")}
        className={styles.forgotPassword}
      >
        Forgot Password
      </Link>
      <Button type="submit" disabled={!formState.isValid}>
        Login
      </Button>
    </form>
  );
};

export default LoginForm;
