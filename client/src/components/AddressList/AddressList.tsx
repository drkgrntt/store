import { gql, useMutation } from "@apollo/client";
import { FC } from "react";
import { FaPen, FaTrash } from "react-icons/fa";
import { useAddresses } from "../../hooks/useAddresses";
import { Address } from "../../types/Address";
import { ucFirst } from "../../utils";
import Selectable from "../Selectable";
import styles from "./AddressList.module.scss";

interface Props {
  editable?: boolean;
  addresses: Address[];
  onEditClick?: (addressId: string) => void;
}

const DELETE_ADDRESS = gql`
  mutation DeleteAddress($id: String!) {
    deleteAddress(id: $id)
  }
`;

const AddressList: FC<Props> = ({
  addresses,
  editable,
  onEditClick = () => null,
}) => {
  const [deleteAddress] = useMutation(DELETE_ADDRESS);
  const { addressToString } = useAddresses();

  const handleDeleteClick = (id: string) => {
    const address = addresses.find((a) => a.id === id);
    if (!address) return;

    const confirm = window.confirm(
      `Are you sure you want to delete ${addressToString(address)}?`
    );
    if (!confirm) return;

    deleteAddress({ variables: { id } });
  };

  return (
    <>
      <h3>Addresses:</h3>
      <ul className={styles.addresses}>
        {addresses.map((address) => {
          return (
            <li key={address.id} className={styles.listItem}>
              <div className={styles.address}>
                <span>{ucFirst(address.type)}:</span>
                <span>{address.recipient}</span>
                <span>{address.lineOne}</span>
                {address.lineTwo && <span>{address.lineTwo}</span>}
                <span>
                  {address.city}, {address.state} {address.zipCode}
                </span>
                <span>{address.country}</span>
              </div>
              {editable && (
                <span className={styles.actions}>
                  <Selectable onClick={() => onEditClick(address.id)}>
                    <FaPen />
                  </Selectable>
                  <Selectable onClick={() => handleDeleteClick(address.id)}>
                    <FaTrash />
                  </Selectable>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
};

export default AddressList;
