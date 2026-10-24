"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// Pages a phone opens from a QR code (/r, /watch): the Convex client without the signed-in app shell.
export const PublicApp = dynamic<{ children: ReactNode }>(
  () => import("./providers").then((m) => m.Providers),
  {
    ssr: false,
    loading: () => (
      <div className="shell">
        <div className="page-state">
          <b>little brother · connecting</b>
        </div>
      </div>
    ),
  },
);
