"use client";

import type { Board } from "@/lib/api";
import { lastBefore } from "@/lib/board-time";
import { useTheme } from "@/lib/theme";

const TONE = { hot: "var(--hot)", warn: "var(--warn)", faint: "var(--faint)" } as const;

export function TopBar({ board, t }: { board: Board | undefined; t: number }) {
  const { choice, toggle } = useTheme();
  const beat = board ? lastBefore(board.beats, t) : undefined;
  const n = board?.agents.length ?? 0;
  return (
    <header className="bar">
      <b>little brother</b>
      {board ? (
        <span className="repo">
          {board.repo || "no repo"} · {n} agent{n === 1 ? "" : "s"}
          {n > 1 ? " working in parallel" : ""}
        </span>
      ) : null}
      {board ? (
        <span className="repo counts">
          <span title="Catches made live, before anything was pushed">{board.counts.caught} caught</span>
          <span title="Conflicts git found that were missed live">{board.counts.missed} missed</span>
        </span>
      ) : null}
      <span className="caption">
        <i style={{ background: TONE[beat?.tone ?? "faint"] }} />
        {beat?.text ?? "Watching"}
      </span>
      <button type="button" className="ctl" onClick={toggle} aria-label="Cycle theme: auto, light, dark">
        theme: {choice}
      </button>
    </header>
  );
}
