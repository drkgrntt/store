import { FC } from "react";
import AdminFrame from "../../AdminFrame";
import ProductList from "../../ProductList";
import styles from "./Admin.module.scss";

interface Props {}

const Admin: FC<Props> = () => {
  return (
    <AdminFrame className={styles.container}>
      <div>
        <ProductList adminView />
      </div>
      <div>Other side</div>
    </AdminFrame>
  );
};

export default Admin;
