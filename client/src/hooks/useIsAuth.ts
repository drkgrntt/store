import { useRouter } from "next/router";
import { useEffect } from "react";
import { useMeQuery } from "./useUser";

export const useIsAuth = (skip?: boolean) => {
  const { data, loading } = useMeQuery({ skip });
  const { replace, pathname, query } = useRouter();
  useEffect(() => {
    if (!skip && !loading && !data?.me) {
      replace({
        pathname: "/",
        query: { ...query, modal: "login", next: pathname },
      });
    }
  }, [loading, data, pathname, query, skip]);
  return { loading };
};
