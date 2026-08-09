import DataLoader from "dataloader";
import { Address } from "../models";

export const createAddressLoader = () => {
  return new DataLoader<string, Address>(async (addressIds) => {
    const addresses = await Address.findAll({
      where: {
        id: addressIds,
      },
    });

    const addressMap = addresses.reduce((map, address) => {
      map[address.id] = address;
      return map;
    }, {} as Record<string, Address>);

    const sortedAddresses = addressIds.map((id) => addressMap[id]);

    return sortedAddresses;
  });
};
