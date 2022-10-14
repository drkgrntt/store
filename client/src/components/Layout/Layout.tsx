import { FC } from "react";
import PageHead from "../PageHead";
import Footer from "./Footer";
import Header from "./Header";
import NavMenu from "./NavMenu";
import styles from "./Layout.module.scss";
import Modal from "../Modal";
import { useUser } from "../../hooks/useUser";
import ProductForm from "../ProductForm";
import { useModal } from "../../hooks/useModal";

const Layout: FC = ({ children }) => {
  const { data: { me: user } = {} } = useUser();
  const { closeModal } = useModal("add-product");

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

      {user?.isAdmin && (
        <Modal name="add-product">
          <ProductForm onSuccess={closeModal} />
        </Modal>
      )}

      <Footer />
    </div>
  );
};

export default Layout;
