import { FC } from "react";
import PageHead from "../PageHead";
import Header from "./Header";
import NavMenu from "./NavMenu";

const Layout: FC = (props) => {
  return (
    <div>
      <PageHead title="Store">
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="language" content="en-us" />
        <meta httpEquiv="X-UA-Compatible" content="ie=edge" />
      </PageHead>

      <NavMenu />

      <Header />

      <main>{props.children}</main>
    </div>
  );
};

export default Layout;
