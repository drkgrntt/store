import { gql, useMutation } from "@apollo/client";
import { FC, FormEvent, useRef } from "react";
import { useForm } from "../../hooks/useForm";
import { useModal } from "../../hooks/useModal";
import { useNotification } from "../../providers/notification";
import Button, { ClickStateRef } from "../Button";
import Input from "../Input";
import styles from "./ContactForm.module.scss";

interface Props { }

const SEND_MESSAGE = gql`
  mutation SendMessage($email: String!, $message: String!) {
    sendMessage(email: $email, message: $message)
  }
`;

const INITIAL_STATE = {
  email: "",
  message: "",
  hp: "",
};

const ContactForm: FC<Props> = () => {
  const formState = useForm(INITIAL_STATE, {
    hp: {
      test: (value) => !value,
      message: "No spam.",
    }
  });
  const [sendMessage] = useMutation(SEND_MESSAGE);
  const { closeModal } = useModal();
  const { createToastNotification, createErrorNotification } =
    useNotification();
  const enableButtonRef = useRef<ClickStateRef>();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = formState.validate();
    if (!isValid) {
      enableButtonRef.current?.();
      return;
    }

    const { email, message, hp } = formState.values;
    sendMessage({
      variables: { email, message },
      onCompleted({ sendMessage }) {
        if (sendMessage) {
          createToastNotification({
            title: "Thank You!",
            body: "Your message was sent. I'll get back with you soon!",
          });
          formState.reset();
          closeModal();
        } else {
          createErrorNotification({
            title: "Something went wrong",
            body: "Please try again later",
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
      className={styles.form}
      onSubmit={handleSubmit}
      ref={formState.formRef}
    >
      <h2>Contact</h2>
      <Input
        formState={formState}
        type="email"
        label="Email"
        name="email"
        required
      />
      <Input
        formState={formState}
        type="textarea"
        label="Message"
        name="message"
        required
      />
      <Input
        formState={formState}
        type="hidden"
        name="hp"
      />
      <Button
        type="submit"
        className={styles.submit}
        disabled={!formState.isValid}
        enableButtonRef={enableButtonRef}
      >
        Submit
      </Button>
    </form>
  );
};

export default ContactForm;
