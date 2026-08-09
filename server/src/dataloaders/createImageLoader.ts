import DataLoader from "dataloader";
import { ProductImage } from "../models";

export const createImageLoader = () => {
  return new DataLoader<string, ProductImage>(async (imageIds) => {
    const images = await ProductImage.findAll({
      where: {
        id: imageIds,
      },
    });

    const imageMap = images.reduce((map, image) => {
      map[image.id] = image;
      return map;
    }, {} as Record<string, ProductImage>);

    const sortedImages = imageIds.map((id) => imageMap[id]);

    return sortedImages;
  });
};
