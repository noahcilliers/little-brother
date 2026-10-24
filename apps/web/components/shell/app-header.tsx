import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { AccountMenu } from "../account/account-menu";
import { ThemeToggle } from "./theme-toggle";

export type Crumb = { label: string; href?: string };

type Props = { crumbs?: Crumb[]; children?: ReactNode };

/** One header for every /app page: wordmark, where you are, page actions, theme and account. */
export function AppHeader({ crumbs = [], children }: Props) {
  return (
    <header className="topnav">
      <Link className="wordmark" href="/app">
        little brother<i aria-hidden="true">▍</i>
      </Link>
      {crumbs.length > 0 ? (
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.map((c) => (
            <Fragment key={c.href ?? c.label}>
              <span className="crumb-sep" aria-hidden="true">
                /
              </span>
              {c.href ? (
                <Link href={c.href} title={c.label}>
                  {c.label}
                </Link>
              ) : (
                <span className="crumb-here" title={c.label} aria-current="page">
                  {c.label}
                </span>
              )}
            </Fragment>
          ))}
        </nav>
      ) : null}
      <div className="topnav-end">
        {children}
        <ThemeToggle />
        <AccountMenu />
      </div>
    </header>
  );
}
