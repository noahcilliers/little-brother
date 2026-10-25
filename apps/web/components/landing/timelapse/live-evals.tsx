"use client";

import type { LandingEvals } from "@lb/core";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { PublicConvex } from "@/components/public-convex";
import { api } from "@/lib/api";
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

/** Renders the snapshot on the server and first paint, then switches to the live Convex query. */
export function LiveEvals({ render }: { render: Render }) {
  return (
    <PublicConvex fallback={render(SNAPSHOT, false)}>
      <Live render={render} />
    </PublicConvex>
  );
}
