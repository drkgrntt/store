import { FC, useReducer } from "react";
import AddressForm from "../../components/AddressForm";
import AddressList from "../../components/AddressList";
import OrderList from "../../components/OrderList";
import { useIsAuth } from "../../hooks/useIsAuth";
import { useUser } from "../../hooks/useUser";

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
  const { data: { me: user } = {} } = useUser();
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
