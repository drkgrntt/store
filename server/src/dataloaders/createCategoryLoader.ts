import DataLoader from "dataloader";
import { Category } from "../models";

export const createCategoryLoader = () => {
  return new DataLoader<string, Category>(async (categoryIds) => {
    const categories = await Category.findAll({
      where: {
        id: categoryIds,
      },
    });

    const categoryMap = categories.reduce((map, category) => {
      map[category.id] = category;
      return map;
    }, {} as Record<string, Category>);

    const sortedCategoryes = categoryIds.map((id) => categoryMap[id]);

    return sortedCategoryes;
  });
};
