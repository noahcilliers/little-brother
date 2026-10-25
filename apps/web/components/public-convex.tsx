"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Component, type ReactNode, useEffect, useState } from "react";
import { convexUrl } from "@/lib/convex-urls";

// A deployment without a query yet (a page shipped before its backend deploy) throws from useQuery; public
// pages must still render, so the fallback takes over.
class Fallback extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type Props = { children: ReactNode; fallback: ReactNode; failed?: ReactNode };

/**
 * An unauthenticated Convex client for public pages outside the app's auth provider. `fallback` renders on
 * the server and first paint, `failed` (default: fallback) if the live query throws.
 */
export function PublicConvex({ children, fallback, failed }: Props) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);
  useEffect(() => {
    const c = new ConvexReactClient(convexUrl());
    setClient(c);
    return () => {
      void c.close();
    };
  }, []);
  if (!client) return <>{fallback}</>;
  return (
    <Fallback fallback={failed ?? fallback}>
      <ConvexProvider client={client}>{children}</ConvexProvider>
    </Fallback>
  );
}
