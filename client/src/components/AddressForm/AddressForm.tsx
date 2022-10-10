import { gql, useMutation } from "@apollo/client";
import { FC, FormEvent, useEffect, useState } from "react";
import { useForm } from "../../hooks/useForm";
import { Address, AddressType } from "../../types/Address";
import Button from "../Button";
import Input from "../Input";
import Selectable from "../Selectable";

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
    $lineTwo: String
  ) {
    createAddress(
      type: $type
      zipCode: $zipCode
      state: $state
      city: $city
      lineOne: $lineOne
      lineTwo: $lineTwo
    ) {
      id
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
  ) {
    updateAddress(
      id: $id
      type: $type
      zipCode: $zipCode
      state: $state
      city: $city
      lineOne: $lineOne
      lineTwo: $lineTwo
    ) {
      id
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
  lineOne: "",
  lineTwo: "",
  city: "",
  state: "",
  zipCode: "",
  type: AddressType.BILLING,
};

const TYPE_OPTIONS = [
  { value: AddressType.BILLING, text: "Billing" },
  { value: AddressType.SHIPPING, text: "Shipping" },
];

const AddressForm: FC<Props> = ({ address, onCancel = () => null }) => {
  const formState = useForm((address as typeof INITIAL_STATE) ?? INITIAL_STATE);
  const [validation, setValidation] = useState("");
  const [createAddress] = useMutation(CREATE_ADDRESS);
  const [updateAddress] = useMutation(UPDATE_ADDRESS);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const mutateAddress = address ? updateAddress : createAddress;
    const { lineOne, lineTwo, city, state, zipCode, type } = formState.values;

    mutateAddress({
      variables: {
        lineOne,
        lineTwo,
        city,
        state,
        zipCode,
        type,
        id: address?.id,
      },
      onCompleted() {
        setValidation("");
        formState.clear();
        onCancel();
      },
      onError(error) {
        setValidation(error.message);
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        formState={formState}
        name="type"
        label="Address Type"
        type="select"
        options={TYPE_OPTIONS}
        required
      />
      <Input formState={formState} name="lineOne" label="Line One" required />
      <Input formState={formState} name="lineTwo" label="Line Two" />
      <Input formState={formState} name="city" label="City" required />
      <Input formState={formState} name="state" label="State" required />
      <Input formState={formState} name="zipCode" label="Zip Code" required />
      <p>{validation}</p>
      <Button type="submit">Save Address</Button>
      <Selectable onClick={onCancel}>Cancel</Selectable>
    </form>
  );
};

export default AddressForm;
