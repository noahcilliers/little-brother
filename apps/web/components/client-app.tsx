"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// The Convex client opens a WebSocket on construction, so the live app mounts in the browser only.
// It sits in the /app layout, so one client and its subscriptions survive navigation between pages.
export const ClientApp = dynamic<{ children: ReactNode }>(() => import("./live-app").then((m) => m.LiveApp), {
  ssr: false,
  loading: () => (
    <div className="shell">
      <div className="page-state">
        <b>little brother · connecting</b>
      </div>
    </div>
  ),
});
