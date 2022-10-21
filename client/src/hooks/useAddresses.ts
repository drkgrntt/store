import { Address } from "../types/Address";
import { useUser } from "./useUser";

export const useAddresses = () => {
  const { user } = useUser();

  const { shippingAddresses = [], billingAddress, addresses = [] } = user ?? {};

  const addressToString = (address: Address) =>
    `${address?.lineOne}${address?.lineTwo ? " " + address.lineTwo : ""}, ${
      address?.city
    }, ${address?.state} ${address?.zipCode}, ${address?.country}`;

  return { shippingAddresses, billingAddress, addresses, addressToString };
};
