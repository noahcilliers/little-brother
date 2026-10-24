"use client";

import { useConvexConnectionState } from "convex/react";
import type { Board } from "@/lib/api";
import { useTheme } from "@/lib/theme";

const TONE = { hot: "var(--hot)", warn: "var(--warn)", faint: "var(--faint)" } as const;

export function TopBar({ board, t }: { board: Board | undefined; t: number }) {
  const { choice, toggle } = useTheme();
  const conn = useConvexConnectionState();
  const latest = board?.feed.find((r) => r.at <= t && r.caption);
  const n = board?.agents.length ?? 0;
  return (
    <header className="bar">
      <b className="word">little brother</b>
      {board ? (
        <span className="repo">
          {board.repo || "no repo"} · {n} agent{n === 1 ? "" : "s"}
        </span>
      ) : null}
      {board ? (
        <span className="counts">
          <span title="Catches made live, before anything was pushed">
            <b>{board.counts.caught}</b> caught
          </span>
          <span title="Conflicts git found that were missed live">
            <b>{board.counts.missed}</b> missed
          </span>
        </span>
      ) : null}
      <span className="caption">
        <i style={{ background: TONE[latest?.tone ?? "faint"] }} />
        {latest?.caption ?? "Watching"}
      </span>
      <span className={conn.isWebSocketConnected ? "live" : "live off"}>
        {conn.isWebSocketConnected ? "live" : "connecting"}
      </span>
      <button type="button" className="ctl" onClick={toggle} aria-label="Toggle light and dark theme">
        theme: {choice}
      </button>
    </header>
  );
}
