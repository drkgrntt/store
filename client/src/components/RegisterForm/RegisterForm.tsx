import { gql, useMutation } from "@apollo/client";
import { useRouter } from "next/router";
import { FC, FormEvent, useRef } from "react";
import { useForm, Validations } from "../../hooks/useForm";
import { useUser } from "../../hooks/useUser";
import { useNotification } from "../../providers/notification";
import { User } from "../../types/User";
import Button, { ClickStateRef } from "../Button";
import Input from "../Input";
import styles from "./RegisterForm.module.scss";

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
  const { query, push } = useRouter();
  const { refetch } = useUser();
  const { createErrorNotification, createToastNotification } =
    useNotification();
  const enableButtonRef = useRef<ClickStateRef>();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = formState.validate();
    if (!isValid) {
      enableButtonRef.current?.();
      return;
    }

    const { email, password } = formState.values;
    register({
      variables: { email, password },
      onError(error) {
        if (error.message === "Validation error")
          error.message = "Invalid email or password";

        createErrorNotification({
          title: "Register error",
          body: error.message,
        });
        enableButtonRef.current?.();
      },
      async onCompleted({ register }) {
        formState.clear();
        await refetch();
        createToastNotification({
          title: "Logged in",
          body: `Logged in as ${register?.email}`,
        });
        enableButtonRef.current?.();
        push((query.next as string) ?? "/");
      },
    });
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className={styles.form}
      ref={formState.formRef}
    >
      <h2>Sign Up</h2>
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
      <Button
        type="submit"
        disabled={!formState.isValid}
        enableButtonRef={enableButtonRef}
      >
        Sign Up
      </Button>
    </form>
  );
};

export default RegisterForm;
