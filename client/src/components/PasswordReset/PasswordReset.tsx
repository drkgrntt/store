import { gql, useMutation } from "@apollo/client";
import { FC, FormEvent } from "react";
import { useForm, Validations } from "../../hooks/useForm";
import { useNotification } from "../../providers/notification";
import Button from "../Button";
import Input from "../Input";

interface Props {}

const INITIAL_STATE = {
  oldPassword: "",
  newPassword: "",
  newPasswordVerify: "",
};

const VALIDATIONS: Validations<typeof INITIAL_STATE> = {
  newPassword: {
    message: "Please make sure this is different than your current password",
    test: (value, values) => values.oldPassword !== value,
  },
  newPasswordVerify: {
    message: "Please make sure this matches what you set as your new password.",
    test: (value, values) => values.newPassword === value,
  },
};

const RESET_PASSWORD = gql`
  mutation ResetPassword($newPassword: String!, $oldPassword: String!) {
    resetPassword(new: $newPassword, old: $oldPassword)
  }
`;

const PasswordReset: FC<Props> = () => {
  const formState = useForm(INITIAL_STATE, VALIDATIONS);
  const [resetPassword] = useMutation(RESET_PASSWORD);
  const { createToastNotification, createErrorNotification } =
    useNotification();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { newPassword, oldPassword } = formState.values;
    resetPassword({
      variables: { newPassword, oldPassword },
      onError(error) {
        if (error.message === "Validation error")
          error.message = "Invalid email or password";
        createErrorNotification({
          title: "Something went wrong",
          body: error.message,
        });
      },
      async onCompleted() {
        formState.clear();
        createToastNotification({
          title: "Success",
          body: "Your password has been reset!",
        });
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Reset Password</h3>
      <Input
        label="Current password"
        required
        name="oldPassword"
        type="password"
        formState={formState}
      />
      <Input
        label="New password"
        required
        name="newPassword"
        type="password"
        formState={formState}
      />
      <Input
        label="New password again"
        required
        name="newPasswordVerify"
        type="password"
        formState={formState}
      />
      <Button disabled={!formState.isValid} type="submit">
        Reset
      </Button>
    </form>
  );
};

export default PasswordReset;
