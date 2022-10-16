import { useRouter } from "next/router";
import { UrlObject } from "url";

export const useModal = () => {
  const { push, query } = useRouter();

  const closeModal = () => {
    push({ query: { ...query, modal: [] } });
  };

  const modalHref = (name: string): UrlObject => ({
    query: { ...query, modal: name },
  });

  const openModal = (name: string) => {
    push(modalHref(name));
  };

  return { closeModal, openModal, modalHref };
};
