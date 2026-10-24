import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Pane({
  title,
  meta,
  children,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("pane", className)}>
      <div className="ph">
        <span>{title}</span>
        {meta ? <small>{meta}</small> : null}
      </div>
      <div className="scroll">{children}</div>
    </div>
  );
}
