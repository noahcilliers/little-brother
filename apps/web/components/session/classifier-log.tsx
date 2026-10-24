"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api, type LogStep, type SessionId } from "@/lib/api";
import { PageState } from "../shell/page-state";
import { LogStepCard } from "./log-step";

function summary(steps: LogStep[]): string {
  const all = steps.flatMap((s) => s.verdicts);
  const by = (src: string) => all.filter((v) => v.source === src).length;
  const caught = all.filter((v) => v.type !== "normal").length;
  const judged = all.filter((v) => v.source === "llm");
  const avg = judged.length ? Math.round(judged.reduce((n, v) => n + v.latencyMs, 0) / judged.length) : 0;
  return [
    `${steps.length} steps · ${all.length} comparisons · ${caught} caught`,
    `rules ${by("rule")} · judge ${by("llm")}${avg ? ` (avg ${(avg / 1000).toFixed(1)} s)` : ""} · fallback ${by("fallback")}`,
  ].join("   ·   ");
}

/** Live record of what the classifier compared in this session and why it decided what it did. */
export function ClassifierLog({ sessionId, watchToken }: { sessionId?: SessionId; watchToken?: string }) {
  const member = useQuery(api.dashboard.log, sessionId ? { sessionId } : "skip");
  const watched = useQuery(api.watch.log, watchToken ? { token: watchToken } : "skip");
  const steps = watchToken ? watched : member;
  const [catchesOnly, setCatchesOnly] = useState(false);
  if (steps === undefined) return <PageState title="Loading classifier log…" />;
  if (steps === null || steps.length === 0)
    return (
      <PageState title="Nothing judged yet">
        <p>
          Each prompt, edit and command in this session is compared with teammates' work; the verdicts land
          here.
        </p>
      </PageState>
    );
  const shown = catchesOnly ? steps.filter((s) => s.verdicts.some((v) => v.type !== "normal")) : steps;
  return (
    <section className="log">
      <div className="log-bar">
        <span className="muted small">{summary(steps)}</span>
        <label className="small">
          <input type="checkbox" checked={catchesOnly} onChange={(e) => setCatchesOnly(e.target.checked)} />{" "}
          catches only
        </label>
      </div>
      {shown.map((s) => (
        <LogStepCard key={s.nodeId} step={s} />
      ))}
    </section>
  );
}
