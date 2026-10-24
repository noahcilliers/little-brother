"use client";

import Link from "next/link";

export type Tab<T extends string> = { id: T; label: string; count?: number };

type Props<T extends string> = {
  tabs: Tab<T>[];
  active: T;
  label: string;
  /** Tabs as links (they survive refresh and can be shared) when `href` is given, else buttons. */
  href?: (id: T) => string;
  onSelect?: (id: T) => void;
};

/** Underlined sub-navigation under a page header, like a deployment's Overview / Logs tabs. */
export function Tabs<T extends string>({ tabs, active, label, href, onSelect }: Props<T>) {
  return (
    <nav className="tabs" aria-label={label}>
      {tabs.map((t) => {
        const body = (
          <>
            {t.label}
            {t.count ? <span className="tab-count">{t.count}</span> : null}
          </>
        );
        const current = t.id === active;
        return href ? (
          <Link
            key={t.id}
            className="tab"
            href={href(t.id)}
            aria-current={current ? "page" : undefined}
            scroll={false}
            replace
          >
            {body}
          </Link>
        ) : (
          <button
            key={t.id}
            type="button"
            className="tab"
            aria-current={current ? "page" : undefined}
            onClick={() => onSelect?.(t.id)}
          >
            {body}
          </button>
        );
      })}
    </nav>
  );
}

type SegProps<T extends string> = {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
};

/** A compact segmented control for filters (all / info / warn / error). */
export function Segmented<T extends string>({ options, value, onChange, label }: SegProps<T>) {
  return (
    <fieldset className="seg">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          className={value === o.id ? "on" : undefined}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}
