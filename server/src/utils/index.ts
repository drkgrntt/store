import { Address } from "../models";

export const addressToString = (address: Address) =>
  `${address?.lineOne}${address?.lineTwo ? " " + address.lineTwo : ""}, ${
    address?.city
  }, ${address?.state} ${address?.zipCode}, ${address?.country}`;
