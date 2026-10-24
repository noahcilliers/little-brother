"use client";

import { useConvexConnectionState, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { AgentsView } from "./agents/agents-view";
import { GraphView } from "./graph/graph-view";
import { MetricsStrip } from "./metrics-strip";
import { ResolveBar } from "./resolve/resolve-bar";
import { TablesView } from "./tables/tables-view";

const VIEWS = ["graph", "tables", "agents"] as const;
type View = (typeof VIEWS)[number];

function viewFromHash(): View {
  const h = window.location.hash.slice(1);
  return VIEWS.find((v) => v === h) ?? "graph";
}

export function Dashboard() {
  const [view, setView] = useState<View>("graph");
  const { choice, toggle } = useTheme();
  const conn = useConvexConnectionState();
  const agents = useQuery(api.dashboard.agents);
  const active = agents?.filter((a) => a.status === "active").length ?? 0;

  useEffect(() => {
    setView(viewFromHash());
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (v: View) => {
    window.history.replaceState(null, "", `#${v}`);
    setView(v);
  };

  return (
    <div className="shell">
      <nav className="nav">
        <span className="word">
          little brother<i>▍</i>
        </span>
        <div className="tabs" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              aria-current={view === v ? "page" : undefined}
              onClick={() => go(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <span className={conn.isWebSocketConnected ? "live" : "live off"}>
          {conn.isWebSocketConnected ? `live · ${active} active` : "connecting to convex…"}
        </span>
        <button type="button" className="ghost-btn" onClick={toggle} aria-label="Toggle light and dark theme">
          theme: {choice}
        </button>
      </nav>
      <MetricsStrip />
      <main className="min-h-0">
        {view === "graph" ? <GraphView /> : view === "tables" ? <TablesView /> : <AgentsView />}
      </main>
      <ResolveBar />
    </div>
  );
}
