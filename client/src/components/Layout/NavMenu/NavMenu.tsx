import { gql, useMutation } from "@apollo/client";
import Link from "next/link";
import { useRouter } from "next/router";
import { FC, MouseEvent, useState } from "react";
import { useUser } from "../../../hooks/useUser";
import { combineClasses } from "../../../utils";
import { FaUser, FaStore, FaArrowCircleRight, FaPenNib } from "react-icons/fa";
import styles from "./NavMenu.module.scss";

interface Props {}

const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

const NavLink: FC<{ href: string; onClick: () => void }> = ({
  children,
  href,
  onClick,
}) => {
  const { pathname } = useRouter();

  return (
    <Link href={href}>
      <a
        onClick={onClick}
        href="#"
        className={combineClasses(
          styles.link,
          pathname === href ? styles.active : ""
        )}
      >
        {children}
      </a>
    </Link>
  );
};

const NavButton: FC<{ onClick: () => void }> = ({ onClick, children }) => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onClick();
  };
  return (
    <a href="#" onClick={handleClick} className={styles.link}>
      {children}
    </a>
  );
};

const NavMenu: FC<Props> = () => {
  const { refetch, data: { me: user } = {} } = useUser();
  const [logout] = useMutation(LOGOUT);
  const [open, setOpen] = useState(false);

  const closeMenu = () => {
    setOpen(false);
  };

  const handleLogout = () => {
    closeMenu();
    logout({
      onCompleted() {
        refetch();
      },
    });
  };

  return (
    <>
      <input
        checked={open}
        onChange={() => setOpen((prev) => !prev)}
        id="nav-toggle"
        className={styles.toggle}
        type="checkbox"
      />
      <label className={styles.toggleButton} htmlFor="nav-toggle">
        <span></span>
      </label>

      <nav className={styles.nav}>
        <NavLink onClick={closeMenu} href="/">
          <FaStore /> Shop
        </NavLink>
        {user ? (
          <>
            <NavLink onClick={closeMenu} href="/profile">
              <FaUser /> Profile
            </NavLink>
            <NavButton onClick={() => handleLogout()}>
              <FaArrowCircleRight /> Logout
            </NavButton>
          </>
        ) : (
          <NavLink onClick={closeMenu} href="/login">
            <FaPenNib />
            Login / Sign Up
          </NavLink>
        )}
      </nav>
    </>
  );
};

export default NavMenu;
