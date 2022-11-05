import { FC } from "react";
import Image from "next/image";
import { ToastNotification } from "../../providers/notification";
import styles from "./Notification.module.scss";
import { combineClasses } from "../../utils";

interface Props {
  notification?: ToastNotification;
}

const Notification: FC<Props> = ({ notification }) => {
  if (!notification) return null;
  return (
    <div
      className={combineClasses(
        styles.wrapper,
        notification.type === "toast" ? styles.toast : styles.error
      )}
    >
      {notification?.icon && (
        <Image
          className={styles.image}
          src={notification.icon}
          alt={notification.title}
          height={100}
          width={100}
        />
      )}
      <div className={styles.text}>
        <h4 className={styles.title}>{notification.title}</h4>
        <p className={styles.body}>{notification.body}</p>
      </div>
    </div>
  );
};

export default Notification;
