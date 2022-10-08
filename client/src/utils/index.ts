export const priceToCurrency = (price: number) => {
  return (price / 100).toFixed(2);
};

export const combineClasses = (...classNames: string[]) => {
  return classNames.filter(Boolean).join(" ").trim();
};
