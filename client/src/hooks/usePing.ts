import { gql, useMutation } from "@apollo/client";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { usePrevious } from "./usePrevious";

const PING = gql`
  mutation Ping($path: String!) {
    ping(path: $path)
  }
`;

export const usePing = () => {
  const { asPath } = useRouter();
  const previous = usePrevious(asPath);
  const [ping] = useMutation(PING);

  useEffect(() => {
    if (asPath === previous) return;
    ping({ variables: { path: asPath } });
  }, [asPath, previous]);
};
