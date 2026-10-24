"use client";

import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { useEnsureAccount } from "@/lib/use-ensure-account";
import { AppHeader } from "./shell/app-header";
import { ErrorBoundary } from "./shell/error-boundary";
import { PageState } from "./shell/page-state";

/** Every /app page: waits for the account, creates its member row on first visit, then renders the page. */
export function AppShell({ children }: { children: ReactNode }) {
  const status = useQuery(api.team.status);
  const me = useQuery(api.team.me);
  const path = usePathname();
  useEnsureAccount(me);
  if (status === undefined || me === undefined)
    return (
      <div className="shell">
        <PageState title="little brother · connecting" />
      </div>
    );
  if (!status.openMode && !me)
    return (
      <div className="shell">
        <PageState title="Sign in to see your rooms">
          <a className="btn-ghost" href="/start">
            Sign in with GitHub →
          </a>
        </PageState>
      </div>
    );
  if (me && !me.member)
    return (
      <div className="shell">
        <PageState title="Setting up your account…" />
      </div>
    );
  const missing = (
    <>
      <AppHeader crumbs={[{ label: "Rooms", href: "/app" }]} />
      <PageState title="Not found">
        <p>This room or session doesn't exist, or you're not in it.</p>
        <a className="btn-ghost" href="/app">
          Back to rooms
        </a>
      </PageState>
    </>
  );
  return (
    <div className="shell">
      <ErrorBoundary key={path} fallback={missing}>
        {children}
      </ErrorBoundary>
    </div>
  );
}
