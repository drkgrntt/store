import { useCallback } from "react";
import { debounce } from "../utils";

export const useDebounce = <Args extends unknown[]>(
  func: (...args: Args) => void,
  wait?: number
) => {
  return useCallback(debounce(func, wait), [func, wait]);
};
