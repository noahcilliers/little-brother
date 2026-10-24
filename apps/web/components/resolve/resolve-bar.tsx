"use client";

import { clsx } from "clsx";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api, type ConflictView, type Id } from "@/lib/api";
import { ago } from "@/lib/format";
import { StateBadge } from "../ui/badge";
import { GitTag } from "../ui/git-tag";
import { Comparison } from "./comparison";

type Side = NonNullable<ConflictView["a"]>;

function Option({ label, side, verdict }: { label: string; side: Side | null; verdict?: "win" | "lose" }) {
  return (
    <div className="grid gap-2">
      <span className="label">{label}</span>
      {side ? (
        <div className={clsx("opt", verdict)}>
          <b>{side.text}</b>
          <span>
            {side.handle} · {side.files.slice(0, 2).join(", ") || side.kind} · {ago(side.at)}
          </span>
        </div>
      ) : (
        <div className="opt">
          <span>node unavailable</span>
        </div>
      )}
    </div>
  );
}

export function ResolveBar() {
  const data = useQuery(api.dashboard.openConflicts);
  const approve = useMutation(api.resolve.approve);
  const dismiss = useMutation(api.resolve.dismiss);
  const [watching, setWatching] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After a decision the bar stays on that conflict so the room can watch delivery reach each agent.
  const c = data?.open[0] ?? data?.recent.find((r) => r._id === watching);
  if (!c) return null;
  const decided = c.status !== "open";
  const keptId = c.resolution?.replace(/^approved /, "");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setWatching(c._id);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const id = c._id as Id<"classifications">;
  const pick = (side: Side | null) =>
    side && run(() => approve({ classificationId: id, keepNodeId: side._id }));
  const verdictOf = (side: Side | null) =>
    decided && side ? (side._id === keptId ? "win" : "lose") : undefined;

  return (
    <section className="resolve" aria-label="Resolve conflict">
      <div className="ph">
        <span className="flex items-center gap-2">
          {decided ? "resolved" : "conflict"} · {c.takeover ? "takeover" : c.relation.replace(/_/g, " ")} ·{" "}
          {c.action}
          <GitTag status={c.gitStatus} />
        </span>
        <small>
          {data && data.open.length > 1 ? `${data.open.length} open · ` : ""}
          {Math.round(c.confidence * 100)}% confidence
        </small>
      </div>
      <div className="rv-body">
        {c.comparison ? <Comparison text={c.comparison} /> : null}
        <Option label="A · existing" side={c.a} verdict={verdictOf(c.a)} />
        <Option label="B · new" side={c.b} verdict={verdictOf(c.b)} />
        <div className="grid content-start gap-2">
          <span className="label">evidence</span>
          {c.takeover ? <b className="note text-[var(--fg)]">{c.takeover}</b> : null}
          <p className="m-0 text-[13px]">{c.reason}</p>
          <ul className="list evidence">
            {c.evidence.slice(0, 4).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <div className="delivery">
            <span className="label">delivery</span>
            {c.delivery.length === 0 ? <span>nothing queued yet</span> : null}
            {c.delivery.map((d) => (
              <span key={d._id} className="inline-flex items-center gap-1" title={d.text}>
                {d.handle} <StateBadge state={d.state} />
              </span>
            ))}
          </div>
        </div>
        <div className="rv-actions">
          {decided ? (
            <button type="button" className="btn quiet" onClick={() => setWatching(null)}>
              Close
            </button>
          ) : (
            <>
              <button type="button" className="btn inv" disabled={busy || !c.a} onClick={() => pick(c.a)}>
                Approve A{c.a ? ` · ${c.a.handle}` : ""}
              </button>
              <button type="button" className="btn" disabled={busy || !c.b} onClick={() => pick(c.b)}>
                Approve B{c.b ? ` · ${c.b.handle}` : ""}
              </button>
              <button
                type="button"
                className="btn quiet"
                disabled={busy}
                onClick={() => run(() => dismiss({ classificationId: id }))}
              >
                Dismiss
              </button>
            </>
          )}
          {error ? <span className="note">{error}</span> : null}
        </div>
      </div>
    </section>
  );
}
