import { gql, useMutation } from "@apollo/client";
import { FC, FormEvent } from "react";
import { useForm } from "../../hooks/useForm";
import { useNotification } from "../../providers/notification";
import Button from "../Button";
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = formState.validate();
    if (!isValid) {
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
        } else {
          createErrorNotification({
            title: "Something went wrong",
            body: "We were unable to send you a reset email. Please try again later.",
          });
        }
      },
      onError(error) {
        createErrorNotification({ title: "Error", body: error.message });
      },
    });
  };

  return (
    <form
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
      >
        Submit
      </Button>
    </form>
  );
};

export default ForgotPasswordForm;
