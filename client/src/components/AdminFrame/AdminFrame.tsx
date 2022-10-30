import Error from "next/error";
import { FC } from "react";
import { useIsAuth } from "../../hooks/useIsAuth";
import { useUser } from "../../hooks/useUser";
import styles from "./AdminFrame.module.scss";

interface Props {
  className?: string;
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
    </div>
  );
};

export default AdminFrame;
