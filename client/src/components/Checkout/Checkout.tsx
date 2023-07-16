import { gql, useMutation, useQuery } from "@apollo/client";
import { useRouter } from "next/router";
import { FC, FormEvent, useEffect, useRef, useState } from "react";
import { useAddresses } from "../../hooks/useAddresses";
import { useForm } from "../../hooks/useForm";
import { useIsAuth } from "../../hooks/useIsAuth";
import { useUser } from "../../hooks/useUser";
import Button, { ClickStateRef } from "../Button";
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
import styles from "./Checkout.module.scss";
import dynamic from "next/dynamic";
const AddressForm = dynamic(() => import("../AddressForm"));

interface Props {}

const INITIAL_STATE = {
  addressId: "",
  notes: "",
};

const PLACE_ORDER = gql`
  mutation PlaceOrder(
    $addressId: String!
    $clientSecret: String!
    $dryRun: Boolean
    $notes: String
  ) {
    placeOrder(
      addressId: $addressId
      clientSecret: $clientSecret
      dryRun: $dryRun
      notes: $notes
    ) {
      id
      userId
      addressId
      isShipped
      isComplete
      shippedOn
      completedOn
      notes
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
      skip: !user || !totalCost || !!query.payment_intent_client_secret,
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
            setShowAddressForm={() => setShowAddressForm(true)}
            showAddressForm={showAddressForm}
          />
        </Elements>
      ) : (
        <Loader />
      )}
    </div>
  );
};

const CheckoutFormWithStripe: FC<{
  setShowAddressForm: () => void;
  showAddressForm: boolean;
  clientSecret: string;
}> = ({ showAddressForm, setShowAddressForm, clientSecret }) => {
  const stripe = useStripe();
  const elements = useElements();
  const formState = useForm(INITIAL_STATE);
  const [placeOrder] = useMutation(PLACE_ORDER);
  const { asPath, push, query } = useRouter();
  const { shippingAddresses, addressToString } = useAddresses();
  const { createToastNotification, createErrorNotification } =
    useNotification();
  const enableButtonRef = useRef<ClickStateRef>();
  const orderPlacedRef = useRef(false);

  useEffect(() => {
    if (!showAddressForm) setTimeout(() => formState.validate(), 1000);
  }, [showAddressForm]);

  useEffect(() => {
    formState.setValues((prev) => ({
      ...prev,
      addressId: shippingAddresses[0]?.id,
    }));
  }, [shippingAddresses]);

  useEffect(() => {
    if (!query.payment_intent_client_secret || orderPlacedRef.current) return;
    orderPlacedRef.current = true;

    placeOrder({
      variables: {
        addressId: query["address-id"],
        notes: decodeURIComponent(query["notes"] as string),
        clientSecret: query.payment_intent_client_secret,
      },
      onCompleted() {
        createToastNotification({
          title: "Thank you!",
          body: "Your order has been placed.",
        });
        orderPlacedRef.current = false;
        push("/");
      },
      onError(error) {
        createErrorNotification({
          title: "Problem with checkout",
          body: error.message,
        });
        push({ query: { ...query, payment_intent_client_secret: [] } });
      },
    });
  }, [query.payment_intent_client_secret]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = formState.validate();
    if (!isValid) {
      enableButtonRef.current?.();
      return;
    }

    if (!stripe || !elements) {
      createErrorNotification({
        title: "Problem with checkout",
        body: "We are having issues. Please try again later.",
      });
      enableButtonRef.current?.();
      return;
    }

    placeOrder({
      variables: {
        addressId: formState.values.addressId,
        clientSecret,
        dryRun: true,
      },
      async onCompleted() {
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url:
              process.env.NEXT_PUBLIC_APP_URL +
              asPath +
              `&modal-params=address-id&address-id=${
                formState.values.addressId
              }&notes=${encodeURIComponent(formState.values.notes)}`,
          },
        });

        if (result.error) {
          // Show error to your customer (for example, payment details incomplete)
          createErrorNotification({
            title: "Problem with checkout",
            body:
              result.error.message ??
              "We are having issues. Please try again later.",
          });
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
        enableButtonRef.current?.();
      },
      onError(error) {
        createErrorNotification({
          title: "Problem with checkout",
          body: error.message,
        });
        enableButtonRef.current?.();
      },
    });
  };

  return (
    <>
      <form
        noValidate
        onSubmit={handleSubmit}
        className={styles.form}
        ref={formState.formRef}
      >
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
        <Selectable onClick={setShowAddressForm}>New address</Selectable>
        <Input
          type="textarea"
          name="notes"
          label="Notes"
          formState={formState}
        />
        <PaymentElement />
        <Button
          enableButtonRef={enableButtonRef}
          disabled={!formState.isValid || !stripe || !elements}
          type="submit"
        >
          Place order!
        </Button>
      </form>
    </>
  );
};

export default Checkout;
