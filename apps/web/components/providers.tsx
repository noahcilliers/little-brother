"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { type ReactNode, useState } from "react";
import { convexUrl } from "@/lib/convex-urls";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new ConvexReactClient(convexUrl()));
  return <ConvexAuthNextjsProvider client={client}>{children}</ConvexAuthNextjsProvider>;
}
