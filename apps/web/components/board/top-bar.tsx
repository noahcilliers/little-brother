"use client";

import type { ReactNode } from "react";
import type { Board } from "@/lib/api";
import { type CatchKind, isOpen, lastBefore } from "@/lib/board-time";
import { CATCH_STYLE } from "@/lib/catch-style";
import { kTokens } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { CATCH_ICON, InlineIcon } from "./icons";

const TONE = { hot: "var(--hot)", warn: "var(--warn)", faint: "var(--faint)" } as const;

type Props = {
  board: Board | undefined;
  t: number;
  highlight: CatchKind | null;
  onHighlight: (k: CatchKind | null) => void;
  /** Open decisions while the modal is closed: the pill reopens it. */
  waiting: number;
  onOpenDecision: () => void;
  /** Avatar menu, top right. */
  account?: ReactNode;
};

function counts(board: Board, t: number) {
  const seen = board.catches.filter((c) => c.t <= t);
  const n = (kind: CatchKind) => seen.filter((c) => c.kind === kind).length;
  const open = seen.filter((c) => c.kind === "conflict" && isOpen(c, t)).length;
  const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  return [
    { kind: "conflict" as const, text: plural(open, "open conflict", "open conflicts"), show: true },
    {
      kind: "duplicate" as const,
      text: `${plural(n("duplicate"), "duplicate", "duplicates")} stopped`,
      show: true,
    },
    { kind: "stale" as const, text: `${n("stale")} stale avoided`, show: true },
    {
      kind: "ordering" as const,
      text: plural(n("ordering"), "ordering wait", "ordering waits"),
      show: n("ordering") > 0,
    },
    {
      kind: "takeover" as const,
      text: plural(n("takeover"), "takeover", "takeovers"),
      show: n("takeover") > 0,
    },
  ].filter((x) => x.show);
}

export function TopBar({ board, t, highlight, onHighlight, waiting, onOpenDecision, account }: Props) {
  const { choice, toggle } = useTheme();
  const beat = board ? lastBefore(board.beats, t) : undefined;
  const n = board?.agents.length ?? 0;
  return (
    <header className="bar">
      <b>little brother</b>
      {board ? (
        <span className="repo">
          {board.repo || "no repo"} · {n} agent{n === 1 ? "" : "s"}
        </span>
      ) : null}
      {board ? (
        <span className="counts">
          {counts(board, t).map((c) => (
            <button
              key={c.kind}
              type="button"
              className="count"
              aria-pressed={highlight === c.kind}
              title="Highlight these catches on the graph"
              onClick={() => onHighlight(highlight === c.kind ? null : c.kind)}
            >
              <InlineIcon name={CATCH_ICON[c.kind]} color={CATCH_STYLE[c.kind].color} size={13} />
              {c.text}
            </button>
          ))}
          {board.counts.saved > 0 ? (
            <span
              className="saved"
              title="Estimated tokens the catches saved: work not duplicated or repeated"
            >
              ~{kTokens(board.counts.saved)} tokens saved
            </span>
          ) : null}
          {board.counts.missed > 0 ? <span className="repo">{board.counts.missed} missed</span> : null}
        </span>
      ) : null}
      {waiting > 0 ? (
        <button type="button" className="needed" onClick={onOpenDecision}>
          <InlineIcon name="bolt" color="var(--hot)" size={13} />
          {waiting === 1 ? "decision needed" : `${waiting} decisions needed`}
        </button>
      ) : null}
      <span className="caption">
        <i style={{ background: TONE[beat?.tone ?? "faint"] }} />
        <span className="caption-text">{beat?.text ?? "Watching"}</span>
      </span>
      <span className="bar-end">
        <button type="button" className="ctl" onClick={toggle} aria-label="Cycle theme: auto, light, dark">
          theme: {choice}
        </button>
        {account}
      </span>
    </header>
  );
}
