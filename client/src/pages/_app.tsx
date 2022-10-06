import "../styles/globals.scss";
import type { AppProps } from "next/app";
import { withApollo } from "../utils/withApollo";
import Layout from "../components/Layout";

const App = ({ Component, pageProps }: AppProps) => {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
};

export default withApollo({ ssr: false })(App as any);
