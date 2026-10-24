"use client";

import { AppShell } from "./app-shell";
import { Providers } from "./providers";

export function LiveApp() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  );
}
