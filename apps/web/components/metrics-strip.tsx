"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { compact } from "@/lib/format";
import { Badge } from "./ui/badge";

export function MetricsStrip() {
  const m = useQuery(api.dashboard.metrics);
  const dash = "—";
  return (
    <div className="tiles metrics">
      <div className="tile metric">
        <b>{m ? m.catches : dash}</b>
        <span>catches before push</span>
      </div>
      <div className="tile metric">
        <b>{m ? compact(m.tokensSaved) : dash}</b>
        <span>est. tokens saved</span>
      </div>
      <div className="tile metric">
        <b>{m?.precision != null ? `${Math.round(m.precision * 100)}%` : dash}</b>
        <span>precision{m ? ` · ${m.confirmed} ok / ${m.falsePositive} fp` : ""}</span>
      </div>
      <div className="tile metric" title="Conflicts a real merge found that the live classifier did not flag">
        <b>{m ? m.missedLive : dash}</b>
        <span>missed live · found by git{m ? ` · ${m.gitConfirmed} git-confirmed` : ""}</span>
      </div>
      <div className="tile metric">
        <b>{m ? m.activeAgents : dash}</b>
        <span>active agents</span>
      </div>
      <div className="tile tally">
        <span className="label">by type</span>
        <span>
          <Badge kind="duplicate" /> {m?.byType.duplicate ?? 0}
        </span>
        <span>
          <Badge kind="stale" /> {m?.byType.stale ?? 0}
        </span>
        <span>
          <Badge kind="conflict" /> {m?.byType.conflict ?? 0}
        </span>
      </div>
    </div>
  );
}
