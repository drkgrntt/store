import { gql, useMutation } from "@apollo/client";
import Link from "next/link";
import { useRouter } from "next/router";
import { FC } from "react";
import { useUser } from "../../../hooks/useUser";
import { combineClasses } from "../../../utils";
import styles from "./NavMenu.module.scss";

interface Props {}

const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

const NavMenu: FC<Props> = () => {
  const { refetch, data: { me: user } = {} } = useUser();
  const { pathname } = useRouter();
  const [logout] = useMutation(LOGOUT);

  const handleLogout = () => {
    logout({
      onCompleted() {
        refetch();
      },
    });
  };

  return (
    <nav className={styles.nav}>
      <Link href="/">
        <a
          href="#"
          className={combineClasses(
            styles.link,
            pathname === "/" ? styles.active : "",
            styles.home
          )}
        >
          Home
        </a>
      </Link>
      {user ? (
        <>
          <Link href="/profile">
            <a
              href="#"
              className={combineClasses(
                styles.link,
                pathname === "/profile" ? styles.active : ""
              )}
            >
              Profile
            </a>
          </Link>
          <a href="#" onClick={() => handleLogout()} className={styles.link}>
            Logout
          </a>
        </>
      ) : (
        <Link href="/login">
          <a
            href="#"
            className={combineClasses(
              styles.link,
              pathname === "/login" ? styles.active : ""
            )}
          >
            Login
          </a>
        </Link>
      )}
    </nav>
  );
};

export default NavMenu;
