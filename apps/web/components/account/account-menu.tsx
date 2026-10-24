"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Avatar } from "./avatar";

/** Top-right of the dashboard: who you are, plus the three things you do from here. */
export function AccountMenu() {
  const me = useQuery(api.team.me);
  const { signOut } = useAuthActions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  // Signed out only happens in local open mode, where there is nothing to put here.
  if (!me) return null;
  const handle = me.member?.handle ?? me.user.login ?? me.user.name;
  return (
    <div className="account" ref={ref}>
      <button
        type="button"
        className="account-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Avatar src={me.user.image} name={handle} />
      </button>
      {open ? (
        <div className="account-menu" role="menu">
          <div className="account-who">
            <b>{me.user.name}</b>
            <span>
              @{handle}
              {me.team ? ` · ${me.team.name}` : ""}
              {me.team?.isOwner ? " · owner" : ""}
            </span>
          </div>
          <a role="menuitem" href="/start#team">
            Invite teammates
          </a>
          <a role="menuitem" href="/start#connect">
            Connect a laptop
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={() => void signOut().then(() => window.location.assign("/"))}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
