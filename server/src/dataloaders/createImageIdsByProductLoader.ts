import DataLoader from "dataloader";
import { ProductImage } from "../models";

export const createImageIdsByProductLoader = () => {
  return new DataLoader<string, string[]>(async (productIds) => {
    const images = await ProductImage.findAll({
      attributes: ["id", "productId"],
      where: {
        productId: productIds,
      },
    });

    // Essentially is of type Record<productId: imageId[]>
    const imageIdsMap = images.reduce((map, image) => {
      map[image.productId] = images
        .filter((i) => image.productId === i.productId)
        .map((i) => i.id);
      return map;
    }, {} as Record<string, string[]>);

    const sortedProductImageIds = productIds.map((id) => imageIdsMap[id] || []);

    return sortedProductImageIds;
  });
};
