import { FC } from "react";
import { Address } from "../../types/Address";
import { ucFirst } from "../../utils";
import styles from "./AddressList.module.scss";

interface Props {
  addresses: Address[];
}

const AddressList: FC<Props> = ({ addresses }) => {
  return (
    <>
      <h3>Addresses:</h3>
      <ul className={styles.addresses}>
        {addresses.map((address) => {
          return (
            <li key={address.id} className={styles.address}>
              <span>{ucFirst(address.type)}:</span>
              <span>{address.lineOne}</span>
              {address.lineTwo && <span>{address.lineTwo}</span>}
              <span>
                {address.city}, {address.state} {address.zipCode}
              </span>
              <span>{address.country}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
};

export default AddressList;
