import { useRouter } from "next/router";
import { useEffect } from "react";
import { useModal } from "./useModal";
import { useMeQuery } from "./useUser";

export const useIsAuth = (skip?: boolean) => {
  const { data, loading } = useMeQuery({ skip });
  const { replace, asPath, query } = useRouter();
  const { openModal } = useModal();

  useEffect(() => {
    if (!skip && !loading && !data?.me) {
      openModal(
        "login",
        {
          next: asPath,
          ["modal-params"]: ["next"],
          message: "Please login or create an account to continue!",
        },
        true
      );
    }
  }, [loading, data, asPath, query, skip]);
  return { loading };
};
