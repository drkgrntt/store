import "../styles/globals.scss";
import { AppPropsWithApollo, withApollo } from "../utils/withApollo";
import Layout from "../components/Layout";
import CartProvider from "../providers/cart";

const App = ({
  Component,
  pageProps,
  apolloClient,
  apolloState,
}: AppPropsWithApollo) => {
  return (
    <CartProvider>
      <Layout>
        <Component
          {...pageProps}
          apolloClient={apolloClient}
          apolloState={apolloState}
        />
      </Layout>
    </CartProvider>
  );
};

export default withApollo({ ssr: false })(App as any);
