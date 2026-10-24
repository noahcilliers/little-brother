import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

/** One icon, one sentence, at most one action. */
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon ? (
        <span className="empty-icon">
          <Icon name={icon} size={20} />
        </span>
      ) : null}
      <p>{title}</p>
      {children}
    </div>
  );
}
