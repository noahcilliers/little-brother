"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Board } from "@/lib/api";
import type { Layout } from "@/lib/board-layout";
import { bandOffsets, type Lookup } from "@/lib/board-time";
import { GraphGoals, GraphGrid, NowLine } from "./graph-axis";
import { GraphCatches } from "./graph-catches";
import { GraphShared, VerifyBadges } from "./graph-shared";
import { TaskBar } from "./task-bar";

type Props = {
  board: Board;
  layout: Layout;
  t: number;
  /** Live or replaying: the view scrolls to keep now in sight. */
  follow: boolean;
  selected: string | null;
  focus: string | null;
  onSelect: (id: string | null) => void;
  colorOf: (agentId: string) => string;
};

/** One shared time axis: a row per agent, goal brackets, task bars, the lessons and decisions bands, catches. */
export function Graph({ board, layout, t, follow, selected, focus, onSelect, colorOf }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const lookup: Lookup = useMemo(
    () => ({
      tasks: new Map(board.tasks.map((k) => [k.id, k])),
      shared: new Map(board.shared.map((s) => [s.id, s])),
      layout,
      bandDy: bandOffsets(board.shared, layout),
    }),
    [board, layout],
  );
  // The next bar's start in the same row bounds how long a label under a short bar may run.
  const nextX = useMemo(() => {
    const out = new Map<string, number>();
    for (const k of board.tasks) {
      const next = board.tasks.find((o) => o.agentId === k.agentId && o.t0 > k.t0);
      out.set(k.id, next ? layout.xAt(next.t0) : layout.width - 20);
    }
    return out;
  }, [board, layout]);
  const nowX = layout.xAt(t);

  useEffect(() => {
    const el = box.current;
    if (!el || !follow) return;
    const target = nowX - el.clientWidth * 0.6;
    if (Math.abs(el.scrollLeft - target) > 40) el.scrollLeft = Math.max(0, target);
  }, [nowX, follow]);

  const toggle = (id: string) => onSelect(selected === id ? null : id);
  return (
    <div className="card graph" ref={box}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width}
        height={layout.height}
        role="img"
        aria-label="Agents' tasks over time"
        onClick={() => onSelect(null)}
        onKeyDown={(e) => (e.key === "Escape" ? onSelect(null) : undefined)}
      >
        <GraphGrid layout={layout} agents={board.agents} colorOf={colorOf} />
        <GraphGoals goals={board.goals} layout={layout} t={t} focus={focus} colorOf={colorOf} />
        {board.tasks.map((k) => (
          <TaskBar
            key={k.id}
            k={k}
            nextX={nextX.get(k.id) ?? layout.width}
            layout={layout}
            t={t}
            color={colorOf(k.agentId)}
            selected={selected === k.id}
            dim={focus !== null && focus !== k.agentId}
            onSelect={toggle}
          />
        ))}
        <GraphShared shared={board.shared} lookup={lookup} t={t} colorOf={colorOf} onSelect={toggle} />
        <GraphCatches catches={board.catches} lookup={lookup} t={t} selected={selected} />
        <NowLine x={nowX} height={layout.height} />
        <VerifyBadges verifies={board.verifies} lookup={lookup} t={t} />
      </svg>
    </div>
  );
}
