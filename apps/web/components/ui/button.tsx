import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const cls = (variant: ButtonVariant, size: Size, block: boolean, extra?: string) =>
  ["button", `button-${variant}`, `button-${size}`, block ? "button-block" : "", extra ?? ""]
    .filter(Boolean)
    .join(" ");

type Common = {
  variant?: ButtonVariant;
  size?: Size;
  icon?: IconName;
  block?: boolean;
  children?: ReactNode;
};

type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  block = false,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cls(variant, size, block, className)} {...rest}>
      {icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

type LinkProps = Common & { href: string; className?: string; external?: boolean };

/** A link styled as a button; plain <a> for full reloads (sign-in flows), Next Link otherwise. */
export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  icon,
  block = false,
  className,
  external,
  children,
}: LinkProps) {
  const body = (
    <>
      {icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} /> : null}
      {children}
    </>
  );
  const c = cls(variant, size, block, className);
  return external ? (
    <a className={c} href={href}>
      {body}
    </a>
  ) : (
    <Link className={c} href={href}>
      {body}
    </Link>
  );
}

/** Square icon-only button; the label is for screen readers and the tooltip. */
export function IconButton({
  icon,
  label,
  className,
  ...rest
}: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={className ? `icon-btn ${className}` : "icon-btn"}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
