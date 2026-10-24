"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api, type ServerRow, type SessionId } from "@/lib/api";
import { PageState } from "../shell/page-state";

const time = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

type Filter = "all" | "server" | "problems";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "everything" },
  { id: "server", label: "server decisions" },
  { id: "problems", label: "warnings" },
];
const keep = (f: Filter) => (r: ServerRow) =>
  f === "all" ? true : f === "problems" ? r.level !== "info" : !r.kind.startsWith("hook");

/** Host only: every hook the server received for this session and what it did — joins, drops, judge runs. */
export function ServerLog({ sessionId }: { sessionId: SessionId }) {
  const rows = useQuery(api.dashboard.serverLog, { sessionId });
  const [filter, setFilter] = useState<Filter>("all");
  if (rows === undefined) return <PageState title="Loading server log…" />;
  if (rows === null) return <PageState title="Only the room's host sees the server log" />;
  const shown = rows.filter(keep(filter));
  const warns = rows.filter((r) => r.level !== "info").length;
  return (
    <section className="log">
      <div className="log-bar">
        <span className="muted small">
          {rows.length} lines · {warns} warnings · live
        </span>
        <div className="seg" role="tablist" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={filter === f.id ? "on" : undefined}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <ol className="srv">
        {shown.map((r) => (
          <li key={r.id} className={`srv-row l-${r.level}`}>
            <span className="srv-time">{time(r.at)}</span>
            <span className="srv-kind">{r.kind}</span>
            <span className="srv-who">@{r.who}</span>
            <span className="srv-text">{r.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
