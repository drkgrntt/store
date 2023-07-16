import { gql, useMutation } from "@apollo/client";
import { FC, FormEvent, useRef } from "react";
import { useForm } from "../../hooks/useForm";
import { useNotification } from "../../providers/notification";
import Button, { ClickStateRef } from "../Button";
import Input from "../Input";
import styles from "./ForgotPasswordForm.module.scss";

interface Props {}

const FORGOT_PASSWORD = gql`
  mutation ForgotPassword($email: String!) {
    forgotPassword(email: $email)
  }
`;

const INITIAL_STATE = {
  email: "",
};

const ForgotPasswordForm: FC<Props> = () => {
  const formState = useForm(INITIAL_STATE);
  const { createToastNotification, createErrorNotification } =
    useNotification();
  const [forgotPassword] = useMutation(FORGOT_PASSWORD);
  const enableButtonRef = useRef<ClickStateRef>();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = formState.validate();
    if (!isValid) {
      enableButtonRef.current?.();
      return;
    }

    forgotPassword({
      variables: { email: formState.values.email },
      onCompleted({ forgotPassword }) {
        if (forgotPassword) {
          createToastNotification({
            title: "Email sent",
            body: "Check your inbox for an email to reset your password.",
          });
          enableButtonRef.current?.();
        } else {
          createErrorNotification({
            title: "Something went wrong",
            body: "We were unable to send you a reset email. Please try again later.",
          });
          enableButtonRef.current?.();
        }
      },
      onError(error) {
        createErrorNotification({ title: "Error", body: error.message });
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
      <h2>Forgot Password</h2>
      <Input
        formState={formState}
        type="email"
        name="email"
        label="Email"
        required
      />
      <Button
        className={styles.submit}
        type="submit"
        disabled={!formState.isValid}
        enableButtonRef={enableButtonRef}
      >
        Submit
      </Button>
    </form>
  );
};

export default ForgotPasswordForm;
