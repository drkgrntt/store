import { FC } from "react";
import PageHead from "../PageHead";
import Footer from "./Footer";
import Header from "./Header";
import NavMenu from "./NavMenu";
import styles from "./Layout.module.scss";
import Modal from "../Modal";
import { useUser } from "../../hooks/useUser";

const Layout: FC = ({ children }) => {
  const { data: { me: user } = {} } = useUser();

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
        <Modal wide name="add-product">
          nice
        </Modal>
      )}

      <Footer />
    </div>
  );
};

export default Layout;
