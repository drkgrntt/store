import { FC, useReducer } from "react";
import AddressList from "../../AddressList";
import OrderList from "../../OrderList";
import { useIsAuth } from "../../../hooks/useIsAuth";
import { useUser } from "../../../hooks/useUser";
import PasswordReset from "../../PasswordReset";
import styles from "./Profile.module.scss";
import Button from "../../Button";
import { gql, useMutation } from "@apollo/client";
import { useNotification } from "../../../providers/notification";
import dynamic from "next/dynamic";
import ChangeEmail from "../../ChangeEmail";
const AddressForm = dynamic(() => import("../../AddressForm"));

const PROFILE_STATE = {
  addressId: "",
};

const LOGOUT_EVERYWHERE = gql`
  mutation LogoutEverywhere {
    logoutEverywhere {
      id
      value
      userId
      createdAt
      updatedAt
    }
  }
`;

type Action =
  | { type: "editAddress"; payload: string }
  | { type: "clearAddress" };

const profileReducer = (state: typeof PROFILE_STATE, action: Action) => {
  switch (action.type) {
    case "editAddress":
      return { ...state, addressId: action.payload };
    case "clearAddress":
      return { ...state, addressId: "" };
    default:
      throw new Error();
  }
};

const Profile: FC = () => {
  useIsAuth();
  const { user } = useUser();
  const [state, dispatch] = useReducer(profileReducer, PROFILE_STATE);
  const [logoutEverywhere] = useMutation(LOGOUT_EVERYWHERE);
  const { createToastNotification, createErrorNotification } =
    useNotification();

  if (!user) return null;

  const handleLogoutEverywhere = () => {
    logoutEverywhere({
      onCompleted() {
        createToastNotification({
          title: "Success!",
          body: "You have now logged out everywhere except the device you are currently using.",
        });
      },
      onError(error) {
        createErrorNotification({
          title: "There was a problem. Please try again later.",
          body: error.message,
        });
      },
    });
  };

  return (
    <div className={styles.container}>
      <div>
        <AddressList
          addresses={user.addresses}
          editable
          onEditClick={(id) => dispatch({ type: "editAddress", payload: id })}
        />
        <AddressForm
          onCancel={() => dispatch({ type: "clearAddress" })}
          address={user.addresses.find((a) => a.id === state.addressId)}
        />
      </div>
      <div>
        <h3>Orders</h3>
        <OrderList orders={user.orders} />
        <ChangeEmail />
        <PasswordReset />
        <hr />
        <div>
          <p>
            Clicking this button will log out out everywhere except right here.
            You might need to do this if you forgot to logout when you were
            somewhere public. This is also a good step to take after you reset
            your password, especially if you think someone gained access to your
            account who should not have.
          </p>
          <Button onClick={handleLogoutEverywhere}>Logout Everywhere</Button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
