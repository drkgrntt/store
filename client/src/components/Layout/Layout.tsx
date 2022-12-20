import { FC, ReactNode } from "react";
import PageHead from "../PageHead";
import Footer from "./Footer";
import Header from "./Header";
import NavMenu from "./NavMenu";
import styles from "./Layout.module.scss";
import Modal from "../Modal";
import ProductForm from "../ProductForm";
import { useModal } from "../../hooks/useModal";
import Cart from "../Cart";
import LoginForm from "../LoginForm";
import RegisterForm from "../RegisterForm";
import ForgotPasswordForm from "../ForgotPasswordForm";
import Checkout from "../Checkout";
import { useApolloClient } from "@apollo/client";
import { useUser } from "../../hooks/useUser";
import ResetForgottenPasswordForm from "../ResetForgottenPasswordForm";
import About from "../About";
import Faq from "../Faq";
import ContactForm from "../ContactForm";
import ProductDetail from "../ProductDetail";
import ImageDisplay from "../ImageDisplay";
import { useRouter } from "next/router";

interface Props {
  children?: ReactNode;
}

const Layout: FC<Props> = ({ children }) => {
  const { closeModal } = useModal();
  const { reFetchObservableQueries } = useApolloClient();
  const { user } = useUser();
  const { query } = useRouter();

  return (
    <div>
      <PageHead
        title="Midwest Daisy Collective | Small-batch colorful and quirky earrings (and a few things in between)"
        description="Small-batch colorful and quirky earrings (and a few things in between)"
        keywords="Small-batch colorful and quirky earrings (and a few things in between)"
        image={`${process.env.NEXT_PUBLIC_APP_URL}/images/thumbnail.jpg`}
      >
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="language" content="en-us" />
        <meta httpEquiv="X-UA-Compatible" content="ie=edge" />

        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5" />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#ffffff" />

        <link
          rel="apple-touch-icon"
          sizes="57x57"
          href="/apple-touch-icon.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
      </PageHead>

      <NavMenu />

      <Header />

      <main className={styles.container}>{children}</main>

      <Modal name="image" wide>
        <ImageDisplay />
      </Modal>

      <Modal name="detail" wide>
        <ProductDetail />
      </Modal>

      <Modal name="about">
        <About />
      </Modal>

      <Modal name="faq">
        <Faq />
      </Modal>

      <Modal name="contact">
        <ContactForm />
      </Modal>

      {user?.isAdmin && (
        <Modal name="product-form">
          <ProductForm
            onSuccess={() => {
              closeModal();
              reFetchObservableQueries();
            }}
          />
        </Modal>
      )}

      <Modal name="cart">
        <Cart />
      </Modal>

      <Modal name="checkout">
        <Checkout />
      </Modal>

      <Modal name="login">
        {query.message && <p>{query.message}</p>}
        <div className={styles.loginContainer}>
          <RegisterForm />
          <LoginForm />
        </div>
      </Modal>

      <Modal name="forgot-password">
        <ForgotPasswordForm />
      </Modal>

      <Modal name="reset-forgotten-password">
        <ResetForgottenPasswordForm />
      </Modal>

      <Footer />
    </div>
  );
};

export default Layout;
