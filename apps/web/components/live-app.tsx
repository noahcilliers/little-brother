"use client";

import type { ReactNode } from "react";
import { AppShell } from "./app-shell";
import { Providers } from "./providers";

export function LiveApp({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
