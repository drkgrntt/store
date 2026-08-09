import DataLoader from "dataloader";
import { Address } from "../models";

export const createAddressIdsByUserLoader = () => {
  return new DataLoader<string, string[]>(async (userIds) => {
    const addresses = await Address.findAll({
      attributes: ["id", "userId"],
      where: {
        userId: userIds,
      },
    });

    // Essentially is of type Record<userId: addressId[]>
    const addressIdsMap = addresses.reduce((map, address) => {
      map[address.userId] = addresses
        .filter((a) => address.userId === a.userId)
        .map((a) => a.id);
      return map;
    }, {} as Record<string, string[]>);

    const sortedAddressIds = userIds.map((id) => addressIdsMap[id] || []);

    return sortedAddressIds;
  });
};
