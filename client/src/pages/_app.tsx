import "../styles/globals.scss";
import { AppPropsWithApollo, withApollo } from "../utils/withApollo";
import Layout from "../components/Layout";

const App = ({
  Component,
  pageProps,
  apolloClient,
  apolloState,
}: AppPropsWithApollo) => {
  return (
    <Layout>
      <Component
        {...pageProps}
        apolloClient={apolloClient}
        apolloState={apolloState}
      />
    </Layout>
  );
};

export default withApollo({ ssr: false })(App as any);
