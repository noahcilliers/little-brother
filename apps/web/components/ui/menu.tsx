"use client";

import Link from "next/link";
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icon, type IconName } from "./icon";

const Close = createContext<() => void>(() => undefined);

type MenuProps = {
  /** What the trigger button shows. */
  trigger: ReactNode;
  label: string;
  triggerClass?: string;
  align?: "start" | "end";
  side?: "bottom" | "top";
  wide?: boolean;
  children: ReactNode;
};

const items = (root: HTMLElement | null) =>
  Array.from(root?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

/** A dropdown: closes on outside press, Esc or a pick; arrow keys move between items. */
export function Menu({
  trigger,
  label,
  triggerClass,
  align = "start",
  side = "bottom",
  wide,
  children,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    items(list.current)[0]?.focus();
    const close = (e: MouseEvent | globalThis.KeyboardEvent) => {
      if (
        e instanceof globalThis.KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const all = items(list.current);
    const at = all.indexOf(document.activeElement as HTMLElement);
    const next = (at + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length;
    all[next]?.focus();
  };
  return (
    <div className="menu-anchor" ref={ref}>
      <button
        type="button"
        className={triggerClass ?? "menu-trigger"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={list}
          className={`menu menu-${align} menu-${side}${wide ? " menu-wide" : ""}`}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onKey}
        >
          <Close.Provider value={() => setOpen(false)}>{children}</Close.Provider>
        </div>
      ) : null}
    </div>
  );
}

type ItemProps = {
  icon?: IconName;
  href?: string;
  onSelect?: () => void;
  danger?: boolean;
  checked?: boolean;
  children: ReactNode;
};

export function MenuItem({ icon, href, onSelect, danger, checked, children }: ItemProps) {
  const close = useContext(Close);
  const cls = danger ? "menu-item danger" : "menu-item";
  const body = (
    <>
      {icon ? <Icon name={icon} /> : null}
      <span className="menu-item-text">{children}</span>
      {checked ? <Icon name="check" className="menu-check" /> : null}
    </>
  );
  if (href)
    return (
      <Link role="menuitem" className={cls} href={href} onClick={close}>
        {body}
      </Link>
    );
  return (
    <button
      role="menuitem"
      type="button"
      className={cls}
      onClick={() => {
        close();
        onSelect?.();
      }}
    >
      {body}
    </button>
  );
}

export const MenuLabel = ({ children }: { children: ReactNode }) => (
  <div className="menu-label">{children}</div>
);
export const MenuSeparator = () => <hr className="menu-sep" />;
