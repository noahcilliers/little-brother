"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { Avatar } from "../account/avatar";
import { Icon } from "../ui/icon";
import { ThemeToggle } from "./theme-toggle";

/** Bottom of the sidebar: who you are, the theme, sign out, and the collapse toggle. */
export function AccountFooter({ collapsed, onCollapse }: { collapsed: boolean; onCollapse?: () => void }) {
  const me = useQuery(api.team.me);
  const { signOut } = useAuthActions();
  const handle = me ? (me.member?.handle ?? me.user.login ?? me.user.name) : null;
  const collapse = onCollapse ? (
    <button
      type="button"
      className="icon-btn"
      onClick={onCollapse}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <Icon name="sidebar" />
    </button>
  ) : null;
  return (
    <div className={collapsed ? "side-foot collapsed" : "side-foot"}>
      {me && handle ? (
        <div className="who">
          <Avatar src={me.user.image} name={handle} size={28} />
          {collapsed ? null : (
            <span className="who-text">
              <b title={me.user.name}>{me.user.name}</b>
              <small>@{handle}</small>
            </span>
          )}
        </div>
      ) : collapsed ? null : (
        <div className="who">
          <span className="who-text">
            <small>Local open mode</small>
          </span>
        </div>
      )}
      <div className="side-tools">
        <ThemeToggle compact={collapsed} />
        {me ? (
          <button
            type="button"
            className="icon-btn"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void signOut().then(() => window.location.assign("/"))}
          >
            <Icon name="logout" />
          </button>
        ) : null}
        {collapse}
      </div>
    </div>
  );
}
