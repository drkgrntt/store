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
  FaCogs,
} from "react-icons/fa";
import styles from "./NavMenu.module.scss";
import { UrlObject } from "url";
import { useModal } from "../../../hooks/useModal";
import Selectable from "../../Selectable";
import { useCart } from "../../../providers/cart";

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
  const { refetch, user } = useUser();
  const [logout] = useMutation(LOGOUT);
  const [open, setOpen] = useState(false);
  const { modalHref } = useModal();
  const { totalQuantity } = useCart();

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
      <div className={styles.cartWrapper}>
        <Link href={modalHref("cart")}>
          <a className={styles.cartLink}>
            <FaShoppingCart /> ({totalQuantity})
          </a>
        </Link>
      </div>

      <input
        checked={open}
        onChange={toggleMenu}
        id="nav-toggle"
        className={styles.toggle}
        type="checkbox"
      />
      <div className={styles.toggleButtonBorder}>
        <label className={styles.toggleButton} htmlFor="nav-toggle">
          <span />
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
        <NavLink
          onFocus={openMenu}
          onBlur={closeMenu}
          onClick={closeMenu}
          href={modalHref("cart")}
        >
          <FaShoppingCart /> Cart
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
            {user.isAdmin && (
              <>
                <hr className={styles.line} />
                <NavLink
                  onFocus={openMenu}
                  onBlur={closeMenu}
                  onClick={closeMenu}
                  href={modalHref("product-form")}
                >
                  <FaPlus /> Add Product
                </NavLink>{" "}
                <NavLink
                  onFocus={openMenu}
                  onBlur={closeMenu}
                  onClick={closeMenu}
                  href="/admin"
                >
                  <FaCogs /> Admin
                </NavLink>
              </>
            )}
          </>
        ) : (
          <NavLink
            onFocus={openMenu}
            onBlur={closeMenu}
            onClick={closeMenu}
            href={modalHref("login")}
          >
            <FaPenNib />
            Login / Sign Up
          </NavLink>
        )}
        <footer className={styles.footer}>
          {user && (
            <>
              <p className={styles.userInfo}>Logged in as {user.email}</p>
              <Selectable
                onFocus={openMenu}
                onBlur={closeMenu}
                onClick={() => handleLogout()}
                className={styles.footerItem}
              >
                <FaArrowCircleRight /> Logout
              </Selectable>
            </>
          )}
        </footer>
      </nav>
    </>
  );
};

export default NavMenu;
