"use client";

import type { LandingEvals } from "@lb/core";
import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";
import { Component, type ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { convexUrl } from "@/lib/convex-urls";
import { SNAPSHOT } from "./snapshot";

type Render = (data: LandingEvals, live: boolean) => ReactNode;

/** Published rows win; an empty deployment (nothing published yet) keeps the bundled snapshot. */
function pick(live: LandingEvals | undefined): LandingEvals | null {
  if (!live) return null;
  const hasAny = live.replay !== null || live.classifier !== null || live.summaries.length > 0;
  if (!hasAny) return null;
  return {
    summaries: live.summaries.length ? live.summaries : SNAPSHOT.summaries,
    replay: live.replay ?? SNAPSHOT.replay,
    classifier: live.classifier ?? SNAPSHOT.classifier,
  };
}

function Live({ render }: { render: Render }) {
  const data = pick(useQuery(api.evalLanding.landing, {}));
  return <>{render(data ?? SNAPSHOT, data !== null)}</>;
}

// A deployment without the query yet (published before deploy) throws from useQuery; the landing must
// still render, so the snapshot takes over.
class Fallback extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Renders the snapshot on the server and first paint, then switches to the live Convex query. The landing
 * isn't inside the app's auth provider, so this section opens its own unauthenticated client.
 */
export function LiveEvals({ render }: { render: Render }) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);
  useEffect(() => {
    const c = new ConvexReactClient(convexUrl());
    setClient(c);
    return () => {
      void c.close();
    };
  }, []);
  const still = render(SNAPSHOT, false);
  if (!client) return <>{still}</>;
  return (
    <Fallback fallback={still}>
      <ConvexProvider client={client}>
        <Live render={render} />
      </ConvexProvider>
    </Fallback>
  );
}
