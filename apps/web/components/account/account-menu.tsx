"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Avatar } from "./avatar";

/** Top right of every /app page: who you are, and the places you go from here. */
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
        aria-label={`Account: @${handle}`}
        onClick={() => setOpen(!open)}
      >
        <Avatar src={me.user.image} name={handle} />
        <span className="account-handle">@{handle}</span>
      </button>
      {open ? (
        <div className="account-menu" role="menu">
          <div className="account-who">
            <b>{me.user.name}</b>
            <span>
              @{handle} · {me.rooms} room{me.rooms === 1 ? "" : "s"}
            </span>
          </div>
          <Link role="menuitem" href="/app" onClick={() => setOpen(false)}>
            Rooms
          </Link>
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
