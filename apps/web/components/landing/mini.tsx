import "./mini.css";
import type { ReactNode } from "react";

// Small building blocks shared by the feature scenes, drawn in the landing tokens.

export function MiniTerm({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mt${className ? ` ${className}` : ""}`}>
      <div className="mt-bar">
        <span className="mt-dots">
          <i />
          <i />
          <i />
        </span>
        <span>{title}</span>
      </div>
      <div className="mt-body">{children}</div>
    </div>
  );
}

export function Av({ who }: { who: string }) {
  return <span className="av">{who.charAt(0).toUpperCase()}</span>;
}
