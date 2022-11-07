import { gql, useMutation } from "@apollo/client";
import { useRouter } from "next/router";
import { FC, FormEvent, useRef } from "react";
import { useForm, Validations } from "../../hooks/useForm";
import { useModal } from "../../hooks/useModal";
import { useNotification } from "../../providers/notification";
import Button from "../Button";
import { ClickStateRef } from "../Button/Button";
import Input from "../Input";
import styles from "./ResetForgottenPasswordForm.module.scss";

interface Props {}

const RESET_FORGOTTEN_PASSWORD = gql`
  mutation ResetForgottenPassword(
    $email: String!
    $token: String!
    $password: String!
  ) {
    resetForgottenPassword(email: $email, token: $token, password: $password)
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

const ResetPasswordForm: FC<Props> = () => {
  const formState = useForm(INITIAL_STATE, VALIDATIONS);
  const [resetForgottenPassword] = useMutation(RESET_FORGOTTEN_PASSWORD);
  const { query } = useRouter();
  const { openModal } = useModal();
  const { createToastNotification, createErrorNotification } =
    useNotification();
  const enableButtonRef = useRef<ClickStateRef>();

  if (!query.token) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = formState.validate();
    if (!isValid) {
      enableButtonRef.current?.();
      return;
    }

    resetForgottenPassword({
      variables: {
        email: formState.values.email,
        password: formState.values.password,
        token: query.token,
      },
      onCompleted({ resetForgottenPassword }) {
        if (resetForgottenPassword) {
          createToastNotification({
            title: "Your password has been reset.",
            body: "You can now login using the new password.",
          });
          openModal("login");
        } else {
          createErrorNotification({
            title: "Something went wrong",
            body: "Please try again later.",
          });
        }
        enableButtonRef.current?.();
      },
      onError(error) {
        createErrorNotification({
          title: "Something went wrong",
          body: error.message,
        });
        enableButtonRef.current?.();
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
      <h2>Reset your forgotten password</h2>
      <Input
        required
        id="email"
        label="Email"
        name="email"
        formState={formState}
      />
      <Input
        required
        id="password"
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
        className={styles.submit}
        type="submit"
        disabled={!formState.isValid}
        enableButtonRef={enableButtonRef}
      >
        Reset Password
      </Button>
    </form>
  );
};

export default ResetPasswordForm;
