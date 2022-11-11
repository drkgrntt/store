import { gql, useMutation } from "@apollo/client";
import Link from "next/link";
import { useRouter } from "next/router";
import { FC, MouseEvent, ReactNode, useEffect, useState } from "react";
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
  FaAddressCard,
  FaQuestion,
  FaEnvelope,
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
  scroll?: boolean;
  children?: ReactNode;
}> = ({
  children,
  href,
  onClick,
  scroll = true,
  onFocus = () => {},
  onBlur = () => {},
}) => {
  const { pathname } = useRouter();

  return (
    <Link
      scroll={scroll}
      href={href}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      className={combineClasses(
        styles.link,
        pathname === href ? styles.active : ""
      )}
    >
      {children}
    </Link>
  );
};

const NavButton: FC<{
  onClick: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  children?: ReactNode;
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

  const [isTop, setIsTop] = useState(true);

  useEffect(() => {
    const cb = () => {
      const bodyRect = document.body.getBoundingClientRect();
      const isOutOfView = bodyRect.top <= -250;

      if (isOutOfView && isTop) {
        setIsTop(false);
      } else if (!isOutOfView && !isTop) {
        setIsTop(true);
      }
    };

    document.addEventListener("scroll", cb);
    return () => document.removeEventListener("scroll", cb);
  }, [isTop]);

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
      <div
        className={combineClasses(styles.topBar, isTop ? "" : styles.gone)}
      />
      <div className={styles.cartWrapper}>
        <Link
          href={modalHref("cart")}
          className={styles.cartLink}
          scroll={false}
        >
          <FaShoppingCart /> ({totalQuantity})
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
          scroll={false}
        >
          <FaShoppingCart /> Cart
        </NavLink>
        <NavLink
          onFocus={openMenu}
          onBlur={closeMenu}
          onClick={closeMenu}
          href={modalHref("about")}
          scroll={false}
        >
          <FaAddressCard /> About the Maker
        </NavLink>
        <NavLink
          onFocus={openMenu}
          onBlur={closeMenu}
          onClick={closeMenu}
          href={modalHref("faq")}
          scroll={false}
        >
          <FaQuestion /> FAQ
        </NavLink>
        <NavLink
          onFocus={openMenu}
          onBlur={closeMenu}
          onClick={closeMenu}
          href={modalHref("contact")}
          scroll={false}
        >
          <FaEnvelope /> Contact
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
                  scroll={false}
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
            scroll={false}
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
