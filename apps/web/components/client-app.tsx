"use client";

import dynamic from "next/dynamic";

// The Convex client opens a WebSocket on construction, so the live app mounts in the browser only.
export const ClientApp = dynamic(() => import("./live-app").then((m) => m.LiveApp), {
  ssr: false,
  loading: () => (
    <div className="empty" style={{ height: "100dvh" }}>
      <span className="label">little brother · connecting</span>
    </div>
  ),
});
