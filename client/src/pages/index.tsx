import type { NextPage } from "next";
import Head from "next/head";
import styles from "./Home.module.css";
import { gql, useQuery } from "@apollo/client";

const QUERY = gql`
  {
    ping
  }
`;

const Home: NextPage = () => {
  const query = useQuery(QUERY);
  console.log(query);
  return <div>nice</div>;
};

export default Home;
