import {
  createContext,
  FC,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Notification from "../components/Notification";

export interface NotificationArguments {
  title: string;
  body?: string;
  icon?: string;
}

export interface ToastNotification {
  title: string;
  body?: string;
  icon?: string;
  type: "toast" | "error";
}

type NotificationContext = {
  createBrowserNotification: (
    notificationArguments: NotificationArguments
  ) => void;
  createToastNotification: (
    notificationArguments: NotificationArguments
  ) => void;
  createErrorNotification: (
    notificationArguments: NotificationArguments
  ) => void;
};

export const notificationContext = createContext<NotificationContext>({
  createBrowserNotification: () => {},
  createToastNotification: () => {},
  createErrorNotification: () => {},
});

const NotificationProvider: FC = ({ children }) => {
  const notificationPermissionRef = useRef<NotificationPermission>();
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setNotifications((prev) => {
        const [, ...newState] = prev;
        return newState;
      });
    }, 4000);
    return () => clearTimeout(timeout);
  }, [notifications]);

  useEffect(() => {
    if (!("Notification" in window)) return;
    window.Notification.requestPermission().then(
      (result: NotificationPermission) => {
        notificationPermissionRef.current = result;
      }
    );
  }, []);

  const createBrowserNotification = ({
    title,
    body,
    icon,
  }: NotificationArguments) => {
    if (notificationPermissionRef.current !== "granted") return;

    new Notification(title, {
      body,
      icon,
    });
  };

  const createToastNotification = ({
    title,
    body,
    icon,
  }: NotificationArguments) => {
    const notification: ToastNotification = {
      title,
      body,
      icon,
      type: "toast",
    };
    setNotifications((prev) => [...prev, notification]);
  };

  const createErrorNotification = ({
    title,
    body,
    icon,
  }: NotificationArguments) => {
    const notification: ToastNotification = {
      title,
      body,
      icon,
      type: "error",
    };
    setNotifications((prev) => [...prev, notification]);
  };

  return (
    <notificationContext.Provider
      value={{
        createBrowserNotification,
        createToastNotification,
        createErrorNotification,
      }}
    >
      <Notification notification={notifications[0]} />
      {children}
    </notificationContext.Provider>
  );
};

export const useNotification = () => useContext(notificationContext);

export default NotificationProvider;
