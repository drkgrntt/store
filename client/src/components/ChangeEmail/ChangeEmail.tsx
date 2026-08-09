import { gql, useMutation } from "@apollo/client";
import { FC, FormEvent, useEffect, useRef } from "react";
import { useForm } from "../../hooks/useForm";
import { useUser } from "../../hooks/useUser";
import { useNotification } from "../../providers/notification";
import Button, { ClickStateRef } from "../Button";
import Input from "../Input";
import styles from "./ChangeEmail.module.scss";

const CHANGE_EMAIL = gql`
  mutation ChangeEmail($email: String!) {
    changeEmail(email: $email) {
      id
      email
      updatedAt
    }
  }
`;

interface Props {}

const INITIAL_STATE = {
  email: "",
};

const ChangeEmail: FC<Props> = () => {
  const [changeEmail] = useMutation(CHANGE_EMAIL);
  const formState = useForm(INITIAL_STATE);
  const { user } = useUser();
  const enableButtonRef = useRef<ClickStateRef>();
  const { createToastNotification, createErrorNotification } =
    useNotification();

  useEffect(() => {
    if (!user) return;
    formState.setValues((prev) => ({ ...prev, email: user.email }));
  }, [user]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = formState.validate();
    if (!isValid) {
      enableButtonRef.current?.();
      return;
    }

    changeEmail({
      variables: { email: formState.values.email },
      onCompleted() {
        createToastNotification({
          title: "Change complete",
          body: `Your email has been changed to ${formState.values.email}`,
        });
        enableButtonRef.current?.();
      },
      onError(error) {
        createErrorNotification({
          title: "Problem changing your email",
          body: error.message,
        });
        enableButtonRef.current?.();
      },
    });
  };

  return (
    <div>
      <h3>Change your email</h3>
      <form
        onSubmit={handleSubmit}
        ref={formState.formRef}
        noValidate
        className={styles.form}
      >
        <Input formState={formState} name="email" type="email" label="Email" />
        <Button
          enableButtonRef={enableButtonRef}
          type="submit"
          className={styles.submit}
        >
          Save
        </Button>
      </form>
    </div>
  );
};

export default ChangeEmail;
