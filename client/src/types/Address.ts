export interface Address {
  id: string;
  recipient: string;
  lineOne: string;
  lineTwo?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  type: AddressType;
  createdAt: Date;
  updatedAt: Date;
}

export enum AddressType {
  SHIPPING = "shipping",
  BILLING = "billing",
}
