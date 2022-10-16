import { FC } from "react";
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

const Layout: FC = ({ children }) => {
  const { closeModal } = useModal();

  return (
    <div>
      <PageHead title="Heartland to Home">
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="language" content="en-us" />
        <meta httpEquiv="X-UA-Compatible" content="ie=edge" />
      </PageHead>

      <NavMenu />

      <Header />

      <main className={styles.container}>{children}</main>

      <Modal name="product-form">
        <ProductForm onSuccess={closeModal} />
      </Modal>

      <Modal name="cart">
        <Cart />
      </Modal>

      <Modal className={styles.loginContainer} name="login">
        <RegisterForm />
        <LoginForm />
      </Modal>

      <Footer />
    </div>
  );
};

export default Layout;
