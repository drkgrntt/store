import { useState } from "react";

export const useRerender = () => {
  const [, setCounter] = useState(0);
  return () => setCounter((c) => c + 1);
};
