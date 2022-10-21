import { gql, useMutation } from "@apollo/client";
import { useRouter } from "next/router";
import { FC, FormEvent, useState } from "react";
import { useAddresses } from "../../hooks/useAddresses";
import { useForm } from "../../hooks/useForm";
import { useIsAuth } from "../../hooks/useIsAuth";
import { useUser } from "../../hooks/useUser";
import AddressForm from "../AddressForm";
import Button from "../Button";
import Cart from "../Cart";
import Input from "../Input";
import Selectable from "../Selectable";

interface Props {}

const INITIAL_STATE = {
  addressId: "",
};

const PLACE_ORDER = gql`
  mutation PlaceOrder($addressId: String!) {
    placeOrder(addressId: $addressId) {
      id
      userId
      addressId
      isShipped
      isComplete
      user {
        id
        email
        isAdmin
        createdAt
        updatedAt
        orders {
          id
          userId
          addressId
          isShipped
          isComplete
        }
        cart {
          id
          count
          createdAt
          updatedAt
          product {
            id
            title
            description
            price
            quantity
            isMadeToOrder
            isActive
            createdAt
            updatedAt
          }
        }
      }
      address {
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
  }
`;

const Checkout: FC<Props> = () => {
  useIsAuth();
  const { refetch } = useUser();
  const [validation, setValidation] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const { shippingAddresses, addressToString } = useAddresses();
  const formState = useForm(INITIAL_STATE);
  const [placeOrder] = useMutation(PLACE_ORDER);
  const { push } = useRouter();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    placeOrder({
      variables: { addressId: formState.values.addressId },
      onCompleted() {
        window.alert("Thank you! Your order has been placed.");
        setValidation("");
        push("/");
      },
      onError(error) {
        setValidation(error.message);
      },
    });
  };

  return (
    <div>
      <h2>Checkout</h2>
      <Cart isCheckout />

      {showAddressForm && (
        <AddressForm
          onCancel={() => {
            setShowAddressForm(false);
            refetch();
          }}
        />
      )}

      <form onSubmit={handleSubmit}>
        <Input
          type="select"
          label="Where are we shipping to?"
          options={shippingAddresses.map((address) => ({
            value: address.id,
            text: addressToString(address),
          }))}
          name="addressId"
          required
          formState={formState}
        />
        <Selectable onClick={() => setShowAddressForm(true)}>
          New address
        </Selectable>

        <p>TODO: card form</p>

        <p>{validation}</p>

        <Button disabled={!formState.isValid} type="submit">
          Place order!
        </Button>
      </form>
    </div>
  );
};

export default Checkout;
