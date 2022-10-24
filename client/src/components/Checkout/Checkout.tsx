import { gql, useMutation, useQuery } from "@apollo/client";
import { useRouter } from "next/router";
import { FC, FormEvent, useEffect, useRef, useState } from "react";
import { useAddresses } from "../../hooks/useAddresses";
import { useForm } from "../../hooks/useForm";
import { useIsAuth } from "../../hooks/useIsAuth";
import { useUser } from "../../hooks/useUser";
import AddressForm from "../AddressForm";
import Button from "../Button";
import Cart from "../Cart";
import Input from "../Input";
import Selectable from "../Selectable";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import Loader from "../Loader";
import { useCart } from "../../providers/cart";
import { useNotification } from "../../providers/notification";

interface Props {}

const INITIAL_STATE = {
  addressId: "",
};

const PLACE_ORDER = gql`
  mutation PlaceOrder(
    $addressId: String!
    $clientSecret: String!
    $dryRun: Boolean
  ) {
    placeOrder(
      addressId: $addressId
      clientSecret: $clientSecret
      dryRun: $dryRun
    ) {
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

const CLIENT_SECRET = gql`
  query ClientSecret($totalCost: Float!, $clientSecret: String) {
    clientSecret(totalCost: $totalCost, clientSecret: $clientSecret)
  }
`;

const PAYMENT_SUCCEEDED = gql`
  query PaymentSucceeded($clientSecret: String!) {
    paymentSucceeded(clientSecret: $clientSecret)
  }
`;

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY as string);

const Checkout: FC<Props> = () => {
  useIsAuth();
  const { refetch, user } = useUser();
  const [showAddressForm, setShowAddressForm] = useState(false);
  const { totalCost } = useCart();
  const { query } = useRouter();
  const [clientSecret, setClientSecret] = useState(
    query.payment_intent_client_secret
  );

  const { data: { clientSecret: retrievedClientSecret } = {} } = useQuery(
    CLIENT_SECRET,
    {
      variables: { totalCost, clientSecret },
      skip: !user || !totalCost,
    }
  );

  useEffect(() => {
    if (retrievedClientSecret) setClientSecret(retrievedClientSecret);
  }, [retrievedClientSecret]);

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

      {clientSecret ? (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret: clientSecret as string,
            appearance: {
              variables: {
                fontFamily: "Montserrat, sans-serif",
              },
            },
          }}
        >
          <CheckoutFormWithStripe
            clientSecret={clientSecret as string}
            showAddressForm={() => setShowAddressForm(true)}
          />
        </Elements>
      ) : (
        <Loader />
      )}
    </div>
  );
};

const CheckoutFormWithStripe: FC<{
  showAddressForm: () => void;
  clientSecret: string;
}> = ({ showAddressForm, clientSecret }) => {
  const stripe = useStripe();
  const elements = useElements();
  const formState = useForm(INITIAL_STATE);
  const [placeOrder] = useMutation(PLACE_ORDER);
  const { asPath, push, query } = useRouter();
  const { shippingAddresses, addressToString } = useAddresses();
  const [validation, setValidation] = useState("");
  const { createToastNotification } = useNotification();

  useEffect(() => {
    if (!query.payment_intent_client_secret) return;

    placeOrder({
      variables: {
        addressId: query["address-id"],
        clientSecret: query.payment_intent_client_secret,
      },
      onCompleted() {
        createToastNotification({
          title: "Thank you!",
          body: "Your order has been placed.",
        });
        setValidation("");
        push("/");
      },
      onError(error) {
        setValidation(error.message);
        push({ query: { ...query, payment_intent_client_secret: [] } });
      },
    });
  }, [query]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setValidation("We are having issues. Please try again later.");
      return;
    }

    placeOrder({
      variables: {
        addressId: formState.values.addressId,
        clientSecret,
        dryRun: true,
      },
      async onCompleted() {
        setValidation("");
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url:
              process.env.NEXT_PUBLIC_APP_URL +
              asPath +
              `&modal-params=address-id&address-id=${formState.values.addressId}`,
          },
        });

        if (result.error) {
          // Show error to your customer (for example, payment details incomplete)
          setValidation(
            result.error.message ??
              "We are having issues. Please try again later."
          );
        } else {
          // placeOrder({
          //   variables: { addressId: formState.values.addressId },
          //   onCompleted() {
          //     window.alert("Thank you! Your order has been placed.");
          //     setValidation("");
          //     push("/");
          //   },
          //   onError(error) {
          //     setValidation(error.message);
          //   },
          // });
        }
      },
      onError(error) {
        setValidation(error.message);
      },
    });
  };

  return (
    <>
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
        <Selectable onClick={showAddressForm}>New address</Selectable>
        <PaymentElement />
        <p>{validation}</p>
        <Button
          disabled={!formState.isValid || !stripe || !elements}
          type="submit"
        >
          Place order!
        </Button>{" "}
      </form>
    </>
  );
};

export default Checkout;
