"use client";

import type { ReactNode } from "react";
import { Providers } from "./providers";
import { AppShell } from "./shell/app-shell";

export function LiveApp({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
