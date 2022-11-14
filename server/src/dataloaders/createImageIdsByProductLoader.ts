import DataLoader from "dataloader";
import { ProductImage } from "../models";

export const createImageIdsByProductLoader = () => {
  return new DataLoader<string, string[]>(
    async (productIds: readonly string[]) => {
      const images = await ProductImage.findAll({
        attributes: ["id", "productId"],
        where: {
          productId: productIds,
        },
      });

      // Essentially is of type Record<productId: imageId[]>
      const imageIdsMap = images.reduce((map, image) => {
        map[image.productId] = images
          .filter((ch) => image.productId === ch.productId)
          .map((ch) => ch.id);
        return map;
      }, {} as Record<string, string[]>);

      const sortedProductImageIds = productIds.map(
        (id) => imageIdsMap[id] || []
      );

      return sortedProductImageIds;
    }
  );
};
