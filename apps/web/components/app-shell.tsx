"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { AccountMenu } from "./account/account-menu";
import { Board } from "./board/board";

/** /app: the dashboard for team members (or anyone, on a local open-mode deployment). */
export function AppShell() {
  const status = useQuery(api.team.status);
  const me = useQuery(api.team.me);
  if (status === undefined || me === undefined)
    return (
      <div className="app">
        <p className="empty">little brother · connecting</p>
      </div>
    );
  if (!status.openMode && !me?.member)
    return (
      <div className="app">
        <div className="card gate">
          <b>little brother</b>
          <p>
            {me
              ? "You're signed in, but not on this team yet. Open your invite link, or create the team if you're first."
              : "Sign in to see your team's dashboard."}
          </p>
          <a className="ctl" href="/start">
            Go to setup →
          </a>
        </div>
      </div>
    );
  return <Board account={<AccountMenu />} />;
}
