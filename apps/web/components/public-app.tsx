"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { PageState } from "./shell/page-state";

// Pages opened without the app shell (/login, /onboarding, and /r, /watch from a QR code): the Convex client
// alone, mounted in the browser only.
export const PublicApp = dynamic<{ children: ReactNode }>(
  () => import("./providers").then((m) => m.Providers),
  { ssr: false, loading: () => <PageState title="Loading" loading /> },
);
