import DataLoader from "dataloader";
import { ProductCategory } from "../models";

export const createCategoryIdsByProductLoader = () => {
  return new DataLoader<string, string[]>(async (productIds) => {
    const productCategories = await ProductCategory.findAll({
      attributes: ["id", "productId", "categoryId"],
      where: {
        productId: productIds,
      },
    });

    // Essentially is of type Record<productId: categoryId[]>
    const productCategoryIdsMap = productCategories.reduce(
      (map, productCategory) => {
        map[productCategory.productId] = productCategories
          .filter((pc) => productCategory.productId === pc.productId)
          .map((pc) => pc.categoryId);
        return map;
      },
      {} as Record<string, string[]>
    );

    const sortedCategoryIds = productIds.map(
      (id) => productCategoryIdsMap[id] || []
    );

    return sortedCategoryIds;
  });
};
