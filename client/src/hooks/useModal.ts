import { useRouter } from "next/router";
import { ParsedUrlQuery } from "querystring";
import { useEffect } from "react";
import { UrlObject } from "url";

export const useModal = () => {
  const { push, query, replace } = useRouter();

  const closeModal = () => {
    if (query.prev)
      return push(query.prev as string, undefined, { scroll: false });

    const modalQueryParams: ParsedUrlQuery = {
      ...query,
      modal: [],
      ["modal-params"]: [],
    };
    if (query["modal-params"]) {
      let params = query["modal-params"];
      if (!Array.isArray(params)) params = [params];
      params.forEach((param) => (modalQueryParams[param] = []));
    }
    push({ query: modalQueryParams }, undefined, { scroll: false });
  };

  const modalHref = (
    name: string,
    additionalParams?: ParsedUrlQuery
  ): UrlObject => {
    const modalQueryParams: ParsedUrlQuery = { ...query, modal: name };
    if (additionalParams) {
      modalQueryParams["modal-params"] = Object.keys(additionalParams);
      Object.entries(additionalParams).forEach(
        ([key, value]) => (modalQueryParams[key] = value)
      );
    }
    return {
      query: modalQueryParams,
    };
  };

  const openModal = (
    name: string,
    additionalParams?: ParsedUrlQuery,
    useReplace?: boolean
  ) => {
    const href = modalHref(name, additionalParams);
    if (useReplace) {
      replace(href, undefined, { scroll: false });
    } else {
      push(href, undefined, { scroll: false });
    }
  };

  useEffect(() => {
    const cb = (event: KeyboardEvent) => {
      if (query.modal && event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", cb);
    return () => window.removeEventListener("keydown", cb);
  }, []);

  return { closeModal, openModal, modalHref };
};
