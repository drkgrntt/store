import { FC } from "react";
import PageHead from "../PageHead";
import Footer from "./Footer";
import Header from "./Header";
import NavMenu from "./NavMenu";
import styles from "./Layout.module.scss";

const Layout: FC = ({ children }) => {
  return (
    <div>
      <PageHead title="Store">
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="language" content="en-us" />
        <meta httpEquiv="X-UA-Compatible" content="ie=edge" />
      </PageHead>

      <NavMenu />

      <Header />

      <main className={styles.container}>{children}</main>

      <Footer />
    </div>
  );
};

export default Layout;
