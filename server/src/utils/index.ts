import { Address } from "../models";

export const addressToString = (address: Address) =>
  `${address?.recipient} ${address?.lineOne}${
    address?.lineTwo ? " " + address.lineTwo : ""
  }, ${address?.city}, ${address?.state} ${address?.zipCode}, ${
    address?.country
  }`;

export const toCamelCase = (str: string) =>
  str
    .toLowerCase()
    .replace(/([-_][a-z])/g, (group) =>
      group.toUpperCase().replace("-", "").replace("_", "")
    );
