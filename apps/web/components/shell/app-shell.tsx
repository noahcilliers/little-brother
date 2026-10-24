"use client";

import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PREF, readPref, writePref } from "@/lib/local-pref";
import { useCurrentPlace } from "@/lib/use-current-room";
import { useEnsureAccount } from "@/lib/use-ensure-account";
import { ButtonLink } from "../ui/button";
import { Sheet } from "../ui/dialog";
import { ErrorBoundary } from "./error-boundary";
import { MobileBar } from "./mobile-bar";
import { PageState } from "./page-state";
import { Sidebar } from "./sidebar";

function Frame({ children }: { children: ReactNode }) {
  const place = useCurrentPlace();
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setCollapsed(readPref(PREF.sidebar) === "collapsed"), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: close the phone menu whenever the page changes
  useEffect(() => setNavOpen(false), [path]);
  const collapse = () => {
    writePref(PREF.sidebar, collapsed ? null : "collapsed");
    setCollapsed(!collapsed);
  };
  const missing = (
    <PageState title="Not found">
      <p>This room or session doesn't exist, or you're not in it.</p>
      <ButtonLink href="/app">Back to your rooms</ButtonLink>
    </PageState>
  );
  return (
    <div className={collapsed ? "shell collapsed" : "shell"}>
      <Sidebar place={place} collapsed={collapsed} onCollapse={collapse} />
      <div className="shell-main">
        <MobileBar place={place} onMenu={() => setNavOpen(true)} />
        <ErrorBoundary key={path} fallback={missing}>
          {children}
        </ErrorBoundary>
      </div>
      <Sheet open={navOpen} onClose={() => setNavOpen(false)} title="Menu" side="left" bare>
        <Sidebar place={place} collapsed={false} />
      </Sheet>
    </div>
  );
}

/** Every /app page: waits for the account, creates its member row on first visit, then the sidebar frame. */
export function AppShell({ children }: { children: ReactNode }) {
  const status = useQuery(api.team.status);
  const me = useQuery(api.team.me);
  useEnsureAccount(me);
  const signedOut = status !== undefined && me === null && !status.openMode;
  useEffect(() => {
    // The middleware normally catches this; a session that expires while the page is open lands here.
    if (signedOut) window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }, [signedOut]);
  if (status === undefined || me === undefined || signedOut) return <PageState title="Loading" loading />;
  if (me && !me.member) return <PageState title="Setting up your account…" loading />;
  return <Frame>{children}</Frame>;
}
