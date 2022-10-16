import { gql, useMutation } from "@apollo/client";
import Link from "next/link";
import { useRouter } from "next/router";
import { FC, MouseEvent, useState } from "react";
import { useUser } from "../../../hooks/useUser";
import { combineClasses } from "../../../utils";
import {
  FaUser,
  FaStore,
  FaArrowCircleRight,
  FaPenNib,
  FaShoppingCart,
  FaPlus,
} from "react-icons/fa";
import styles from "./NavMenu.module.scss";
import { UrlObject } from "url";
import { useModal } from "../../../hooks/useModal";
import Selectable from "../../Selectable";

interface Props {}

const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

const NavLink: FC<{
  href: string | UrlObject;
  onClick: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}> = ({ children, href, onClick, onFocus = () => {}, onBlur = () => {} }) => {
  const { pathname } = useRouter();

  return (
    <Link href={href}>
      <a
        onFocus={onFocus}
        onBlur={onBlur}
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

const NavButton: FC<{
  onClick: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}> = ({ onClick, children, onFocus = () => {}, onBlur = () => {} }) => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onClick();
  };
  return (
    <a
      onBlur={onBlur}
      onFocus={onFocus}
      href="#"
      onClick={handleClick}
      className={styles.link}
    >
      {children}
    </a>
  );
};

const NavMenu: FC<Props> = () => {
  const { refetch, data: { me: user } = {} } = useUser();
  const [logout] = useMutation(LOGOUT);
  const [open, setOpen] = useState(false);
  const { modalHref } = useModal();

  const closeMenu = () => setOpen(false);
  const openMenu = () => setOpen(true);
  const toggleMenu = () => setOpen((prev) => !prev);

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
        onChange={toggleMenu}
        id="nav-toggle"
        className={styles.toggle}
        type="checkbox"
      />
      <div className={styles.toggleButtonBorder}>
        <label className={styles.toggleButton} htmlFor="nav-toggle">
          <span></span>
        </label>
      </div>

      <nav className={styles.nav} onFocus={openMenu}>
        <NavLink
          onFocus={openMenu}
          onBlur={closeMenu}
          onClick={closeMenu}
          href="/"
        >
          <FaStore /> Shop
        </NavLink>
        {user ? (
          <>
            <NavLink
              onFocus={openMenu}
              onBlur={closeMenu}
              onClick={closeMenu}
              href="/profile"
            >
              <FaUser /> Profile
            </NavLink>
            <NavLink
              onFocus={openMenu}
              onBlur={closeMenu}
              onClick={closeMenu}
              href={modalHref("cart")}
            >
              <FaShoppingCart /> Cart
            </NavLink>
            {user.isAdmin && (
              <NavLink
                onFocus={openMenu}
                onBlur={closeMenu}
                onClick={closeMenu}
                href={modalHref("product-form")}
              >
                <FaPlus /> Add Product
              </NavLink>
            )}
          </>
        ) : (
          <NavLink
            onFocus={openMenu}
            onBlur={closeMenu}
            onClick={closeMenu}
            href="/login"
          >
            <FaPenNib />
            Login / Sign Up
          </NavLink>
        )}
        <footer className={styles.footer}>
          {user && (
            <Selectable
              onFocus={openMenu}
              onBlur={closeMenu}
              onClick={() => handleLogout()}
            >
              <FaArrowCircleRight /> Logout
            </Selectable>
          )}
        </footer>
      </nav>
    </>
  );
};

export default NavMenu;
