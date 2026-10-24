"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { type ReactNode, useState } from "react";

const DEFAULT_URL = "http://127.0.0.1:3210";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? DEFAULT_URL));
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
