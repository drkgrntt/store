import "../styles/globals.scss";
import type { AppProps } from "next/app";
import { withApollo } from "../utils/withApollo";

const App = ({ Component, pageProps }: AppProps) => {
  return <Component {...pageProps} />;
};

export default withApollo({ ssr: false })(App as any);
