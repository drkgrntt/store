import { FC, useReducer } from "react";
import AddressForm from "../../AddressForm";
import AddressList from "../../AddressList";
import OrderList from "../../OrderList";
import { useIsAuth } from "../../../hooks/useIsAuth";
import { useUser } from "../../../hooks/useUser";

const PROFILE_STATE = {
  addressId: "",
};

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
  console.log({ user });

  if (!user) return null;

  return (
    <div>
      <OrderList orders={user.orders} />
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
  );
};

export default Profile;
