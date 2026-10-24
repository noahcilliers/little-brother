"use client";

import dynamic from "next/dynamic";

// The Convex client opens a WebSocket on construction, so the stepper mounts in the browser only.
export const StartClient = dynamic(() => import("./start-steps").then((m) => m.StartSteps), {
  ssr: false,
  loading: () => <p className="start-loading">connecting…</p>,
});
