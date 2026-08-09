import Error from "next/error";
import { FC, ReactNode } from "react";
import { useIsAuth } from "../../hooks/useIsAuth";
import { useUser } from "../../hooks/useUser";
import ContentForm from "../ContentForm";
import Modal from "../Modal";
import OrderEditForm from "../OrderEditForm";
import styles from "./AdminFrame.module.scss";

interface Props {
  className?: string;
  children?: ReactNode;
}

const AdminFrame: FC<Props> = ({ children, className }) => {
  useIsAuth();
  const { user } = useUser();

  if (!user?.isAdmin)
    return <Error statusCode={401} title="You shouldn't be here." />;

  return (
    <div>
      <h2 className={styles.heading}>Admin Dashboard</h2>
      <div className={className}>{children}</div>

      <Modal name="order-edit-form">
        <OrderEditForm />
      </Modal>

      <Modal name="content-form">
        <ContentForm />
      </Modal>
    </div>
  );
};

export default AdminFrame;
