export const priceToCurrency = (price: number) => {
  return (price / 100).toFixed(2);
};

export const combineClasses = (...classNames: string[]) => {
  return classNames.filter(Boolean).join(" ").trim();
};

export const emptyValue = (value: number | boolean | string | unknown) => {
  switch (typeof value) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "string":
    default:
      return "";
  }
};
