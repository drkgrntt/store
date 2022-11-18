import "../styles/globals.scss";
import { withApollo } from "../utils/withApollo";
import Layout from "../components/Layout";
import CartProvider from "../providers/cart";
import NotificationProvider from "../providers/notification";
import { AppProps } from "next/app";

const App = ({ Component, pageProps }: AppProps) => {
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
