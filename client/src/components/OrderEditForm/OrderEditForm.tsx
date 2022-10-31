import { gql, useMutation, useQuery } from "@apollo/client";
import Error from "next/error";
import { useRouter } from "next/router";
import { FC, FormEvent } from "react";
import { useForm } from "../../hooks/useForm";
import { useModal } from "../../hooks/useModal";
import { useNotification } from "../../providers/notification";
import { Order } from "../../types/Order";
import Button from "../Button";
import Input from "../Input";
import Loader from "../Loader";
import styles from "./OrderEditForm.module.scss";

interface Props {}

const ORDER = gql`
  query Order($id: String!) {
    order(id: $id) {
      id
      notes
      totalCost
      isShipped
      isComplete
      trackingNumber
      shippedOn
      completedOn
      createdAt
    }
  }
`;

const UPDATE_ORDER = gql`
  mutation UpdateOrder(
    $id: String!
    $trackingNumber: String
    $notes: String
    $completedOn: DateTime
    $shippedOn: DateTime
  ) {
    updateOrder(
      id: $id
      trackingNumber: $trackingNumber
      notes: $notes
      completedOn: $completedOn
      shippedOn: $shippedOn
    ) {
      id
      shippedOn
      notes
      completedOn
      trackingNumber
      isShipped
      isComplete
    }
  }
`;

const INITIAL_STATE = {
  notes: undefined,
  shippedOn: undefined,
  completedOn: undefined,
  trackingNumber: undefined,
};

const OrderEditForm: FC<Props> = () => {
  const { query } = useRouter();
  const { loading, data: { order } = {} } = useQuery<{ order: Order }>(ORDER, {
    variables: { id: query.id },
    skip: !query.id,
  });
  const { closeModal } = useModal();
  const [updateOrder] = useMutation(UPDATE_ORDER);
  const formState = useForm((order as typeof INITIAL_STATE) ?? INITIAL_STATE);
  const { createToastNotification, createErrorNotification } =
    useNotification();

  if (loading) return <Loader />;

  if (!order)
    return <Error statusCode={404} title="Could not find the order." />;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { shippedOn, completedOn, trackingNumber, notes } = formState.values;

    updateOrder({
      variables: {
        id: order.id,
        shippedOn,
        completedOn,
        trackingNumber,
        notes,
      },
      onCompleted() {
        createToastNotification({ title: "Order updated" });
        closeModal();
      },
      onError(error) {
        createErrorNotification({
          title: "Problem updating order",
          body: error.message,
        });
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2>Order ID: {order.id}</h2>
      <Input
        type="date"
        name="shippedOn"
        label="Shipped Date"
        formState={formState}
      />
      <Input
        type="date"
        name="completedOn"
        label="Completed Date"
        formState={formState}
      />
      <Input
        name="trackingNumber"
        label="Tracking Number"
        formState={formState}
      />
      <Input name="notes" label="Notes" formState={formState} type="textarea" />
      <Button type="submit" className={styles.submit}>
        Update
      </Button>
    </form>
  );
};

export default OrderEditForm;
