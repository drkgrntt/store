import { useRouter } from "next/router";
import { ParsedUrlQuery } from "querystring";
import { UrlObject } from "url";

export const useModal = () => {
  const { push, query } = useRouter();

  const closeModal = () => {
    const modalQueryParams: ParsedUrlQuery = {
      ...query,
      modal: [],
      modalParams: [],
    };
    if (query.modalParams) {
      let params = query.modalParams;
      if (!Array.isArray(params)) params = [params];
      params.forEach((param) => (modalQueryParams[param] = []));
    }
    push({ query: modalQueryParams });
  };

  const modalHref = (
    name: string,
    additionalParams?: ParsedUrlQuery
  ): UrlObject => {
    const modalQueryParams: ParsedUrlQuery = { ...query, modal: name };
    if (additionalParams) {
      modalQueryParams.modalParams = Object.keys(additionalParams);
      Object.entries(additionalParams).forEach(
        ([key, value]) => (modalQueryParams[key] = value)
      );
    }
    return {
      query: modalQueryParams,
    };
  };

  const openModal = (name: string, additionalParams?: ParsedUrlQuery) => {
    push(modalHref(name, additionalParams));
  };

  return { closeModal, openModal, modalHref };
};
