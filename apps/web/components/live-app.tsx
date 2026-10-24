"use client";

import { Dashboard } from "./dashboard";
import { Providers } from "./providers";

export function LiveApp() {
  return (
    <Providers>
      <Dashboard />
    </Providers>
  );
}
