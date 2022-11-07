import { gql, useMutation } from "@apollo/client";
import { FC, FormEvent, useState } from "react";
import { useForm } from "../../hooks/useForm";
import { Address, AddressType } from "../../types/Address";
import Button from "../Button";
import Input from "../Input";
import Selectable from "../Selectable";
import { State, City } from "country-state-city";
import styles from "./AddressForm.module.scss";
import { useNotification } from "../../providers/notification";
import { useAddresses } from "../../hooks/useAddresses";

interface Props {
  address?: Address;
  onCancel?: () => void;
}

const CREATE_ADDRESS = gql`
  mutation CreateAddress(
    $type: String!
    $zipCode: String!
    $state: String!
    $city: String!
    $lineOne: String!
    $recipient: String!
    $lineTwo: String
  ) {
    createAddress(
      type: $type
      zipCode: $zipCode
      state: $state
      city: $city
      lineOne: $lineOne
      recipient: $recipient
      lineTwo: $lineTwo
    ) {
      id
      recipient
      lineOne
      lineTwo
      city
      state
      zipCode
      country
      type
      userId
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_ADDRESS = gql`
  mutation UpdateAddress(
    $id: String!
    $type: String
    $zipCode: String
    $state: String
    $city: String
    $lineOne: String
    $lineTwo: String
    $recipient: String
  ) {
    updateAddress(
      id: $id
      type: $type
      zipCode: $zipCode
      state: $state
      city: $city
      lineOne: $lineOne
      lineTwo: $lineTwo
      recipient: $recipient
    ) {
      id
      recipient
      lineOne
      lineTwo
      city
      state
      zipCode
      country
      type
      userId
      createdAt
      updatedAt
    }
  }
`;

const INITIAL_STATE = {
  recipient: "",
  lineOne: "",
  lineTwo: "",
  city: "",
  state: "",
  zipCode: "",
  type: AddressType.SHIPPING,
};

const TYPE_OPTIONS = [
  // { value: AddressType.BILLING, text: "Billing" },
  { value: AddressType.SHIPPING, text: "Shipping" },
];

const AddressForm: FC<Props> = ({ address, onCancel = () => null }) => {
  const formState = useForm((address as typeof INITIAL_STATE) ?? INITIAL_STATE);
  const { createToastNotification, createErrorNotification } =
    useNotification();
  const { addressToString } = useAddresses();
  const [createAddress] = useMutation(CREATE_ADDRESS);
  const [updateAddress] = useMutation(UPDATE_ADDRESS);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = formState.validate();
    if (!isValid) {
      return;
    }

    const mutateAddress = address ? updateAddress : createAddress;
    const { recipient, lineOne, lineTwo, city, state, zipCode, type } =
      formState.values;

    mutateAddress({
      variables: {
        recipient,
        lineOne,
        lineTwo,
        city,
        state,
        zipCode,
        type,
        id: address?.id,
      },
      onCompleted() {
        createToastNotification({
          title: "Address created!",
          body: addressToString(formState.values as Address),
        });
        formState.clear();
        onCancel();
      },
      onError(error) {
        createErrorNotification({
          title: "Problem saving address",
          body: error.message,
        });
      },
    });
  };

  const states = State.getStatesOfCountry("US").map((state) => {
    return {
      value: state.isoCode,
      text: state.name,
    };
  });
  const cities = City.getCitiesOfState("US", formState.values.state).map(
    (city) => {
      return { value: city.name, text: city.name };
    }
  );

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className={styles.form}
      ref={formState.formRef}
    >
      <Input
        formState={formState}
        name="type"
        label="Address Type"
        type="select"
        options={TYPE_OPTIONS}
        required
      />
      <Input
        formState={formState}
        name="recipient"
        label="Recipient"
        required
      />
      <Input formState={formState} name="lineOne" label="Line One" required />
      <Input formState={formState} name="lineTwo" label="Line Two" />
      <Input
        formState={formState}
        name="state"
        label="State"
        required
        type="select"
        options={states}
      />
      <Input
        formState={formState}
        name="city"
        label="City"
        required
        type="select"
        options={cities}
      />
      <Input formState={formState} name="zipCode" label="Zip Code" required />
      <div className={styles.buttons}>
        <Button
          type="submit"
          className={styles.submit}
          disabled={!formState.isValid}
        >
          Save Address
        </Button>
        <Selectable onClick={onCancel}>Cancel</Selectable>
      </div>
    </form>
  );
};

export default AddressForm;
