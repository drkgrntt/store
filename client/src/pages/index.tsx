import type { NextPage } from "next";
import styles from "./Home.module.css";
import ProductList from "../components/ProductList";
import { withApollo } from "../utils/withApollo";

const Home: NextPage = () => {
  return <ProductList />;
};

export default withApollo({ ssr: true })(Home);
