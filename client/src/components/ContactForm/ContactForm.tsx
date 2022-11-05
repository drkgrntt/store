import { gql, useMutation } from "@apollo/client";
import { FC, FormEvent } from "react";
import { useForm } from "../../hooks/useForm";
import { useModal } from "../../hooks/useModal";
import { useNotification } from "../../providers/notification";
import Button from "../Button";
import Input from "../Input";
import styles from "./ContactForm.module.scss";

interface Props {}

const SEND_MESSAGE = gql`
  mutation SendMessage($email: String!, $message: String!) {
    sendMessage(email: $email, message: $message)
  }
`;

const INITIAL_STATE = {
  email: "",
  message: "",
};

const ContactForm: FC<Props> = () => {
  const formState = useForm(INITIAL_STATE);
  const [sendMessage] = useMutation(SEND_MESSAGE);
  const { closeModal } = useModal();
  const { createToastNotification, createErrorNotification } =
    useNotification();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { email, message } = formState.values;
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
      },
      onError(error) {
        createErrorNotification({
          title: "Something went wrong",
          body: error.message,
        });
      },
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
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
      <Button
        type="submit"
        className={styles.submit}
        disabled={!formState.isValid}
      >
        Submit
      </Button>
    </form>
  );
};

export default ContactForm;
