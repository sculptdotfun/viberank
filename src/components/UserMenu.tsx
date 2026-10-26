"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown, KeyRound, LogOut, User } from "lucide-react";
import Avatar from "./Avatar";

interface UserMenuProps {
  login?: string;
  name?: string | null;
  image?: string | null;
}

/** Where the account menu goes. Shared with the mobile panel so both list the same places. */
export function accountLinks(login?: string) {
  return [
    ...(login ? [{ href: `/profile/${encodeURIComponent(login)}`, label: "My profile", icon: User }] : []),
    { href: "/settings/tokens", label: "API tokens & autosubmit", icon: KeyRound },
  ];
}

function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
}

/**
 * The signed-in avatar in the desktop nav. It used to be a sign-out button,
 * so the obvious click to find your own profile logged you out instead.
 *
 * A standard menu button: Enter, Space or ArrowDown opens it on the first
 * item, arrows move, Escape closes and returns focus, Tab or a click outside
 * closes it.
 */
export default function UserMenu({ login, name, image }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const items = () => menuItems(menuRef.current);

  useEffect(() => {
    if (!open) return;
    menuItems(menuRef.current)[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const current = list.indexOf(document.activeElement as HTMLElement);
    const focusAt = (index: number) => list[(index + list.length) % list.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(current - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(list.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
    }
  };

  const itemClass =
    "w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md text-foreground hover:bg-surface-2 focus:bg-surface-2 focus:outline-none";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={login ? `Account menu for @${login}` : "Account menu"}
        className="h-9 inline-flex items-center gap-2 px-2.5 text-sm border border-border rounded-md hover:bg-surface-2 transition-colors"
      >
        <Avatar src={image} name={name || login} size="sm" showRing={false} className="w-6 h-6" />
        {login && <span className="hidden lg:inline text-muted max-w-[10rem] truncate">{login}</span>}
        <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 mt-2 w-60 rounded-lg border border-border bg-surface-1 shadow-xl p-1 z-50"
        >
          {accountLinks(login).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} role="menuitem" tabIndex={-1} onClick={() => close(false)} className={itemClass}>
              <Icon className="w-4 h-4 text-muted" />
              {label}
            </Link>
          ))}
          <div className="my-1 h-px bg-border" role="separator" />
          <button role="menuitem" tabIndex={-1} onClick={() => signOut()} className={itemClass}>
            <LogOut className="w-4 h-4 text-muted" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
