import { useRouter } from "next/router";
import { ParsedUrlQuery } from "querystring";

export const useModal = (name: string) => {
  const { push, query } = useRouter();

  const closeModal = () => {
    const queryWithoutModal = Object.entries(query).reduce(
      (current, [key, value]) => {
        if (key !== "modal") {
          current[key] = value;
        }
        return current;
      },
      {} as ParsedUrlQuery
    );
    push({ query: queryWithoutModal });
  };

  const modalHref = { query: { ...query, modal: name } };

  const openModal = () => {
    push(modalHref);
  };

  return { closeModal, openModal, modalHref };
};
