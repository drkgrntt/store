import "../styles/globals.scss";
import { AppPropsWithApollo, withApollo } from "../utils/withApollo";
import Layout from "../components/Layout";
import CartProvider from "../providers/cart";
import NotificationProvider from "../providers/notification";

const App = ({ Component, pageProps }: AppPropsWithApollo) => {
  return (
    <NotificationProvider>
      <CartProvider>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </CartProvider>
    </NotificationProvider>
  );
};

export default withApollo({ ssr: true })(App as any);
