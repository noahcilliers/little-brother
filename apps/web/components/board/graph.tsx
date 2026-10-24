"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Board } from "@/lib/api";
import { BAR_H, type Layout, laneY } from "@/lib/board-layout";
import { bandOffsets, type CatchKind, type Lookup } from "@/lib/board-time";
import { GraphGrid, NowLine } from "./graph-axis";
import { GraphCatches } from "./graph-catches";
import { GoalRegions } from "./graph-goals";
import { GraphShared, VerifyBadges } from "./graph-shared";
import { RowLabels } from "./row-labels";
import { TaskBar } from "./task-bar";
import { ActionTicks } from "./task-marks";

type Props = {
  board: Board;
  layout: Layout;
  t: number;
  /** Live or replaying: the view scrolls to keep now in sight. */
  follow: boolean;
  selected: string | null;
  focus: string | null;
  highlight: CatchKind | null;
  onSelect: (id: string | null) => void;
  colorOf: (agentId: string) => string;
};

/** One shared time axis: a row per agent with goal regions and task lanes, knowledge bands, catches. */
export function Graph({ board, layout, t, follow, selected, focus, highlight, onSelect, colorOf }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const lookup: Lookup = useMemo(
    () => ({
      tasks: new Map(board.tasks.map((k) => [k.id, k])),
      goals: new Map(board.goals.map((g) => [g.id, g])),
      shared: new Map(board.shared.map((s) => [s.id, s])),
      layout,
      bandDy: bandOffsets(board.shared, layout),
    }),
    [board, layout],
  );
  // The next bar's start in the same lane bounds how long a label under a short bar may run.
  const nextX = useMemo(() => {
    const out = new Map<string, number>();
    const lane = (id: string) => layout.laneOf.get(id) ?? 0;
    for (const k of board.tasks) {
      const next = board.tasks.find(
        (o) => o.agentId === k.agentId && lane(o.id) === lane(k.id) && o.t0 > k.t0,
      );
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
    <div className="card graph">
      <RowLabels board={board} layout={layout} t={t} focus={focus} colorOf={colorOf} />
      <div className="scroll" ref={box}>
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          role="img"
          aria-label="Agents' tasks over time"
          onClick={() => onSelect(null)}
          onKeyDown={(e) => (e.key === "Escape" ? onSelect(null) : undefined)}
        >
          <GraphGrid layout={layout} />
          <GoalRegions
            goals={board.goals}
            tasks={board.tasks}
            layout={layout}
            t={t}
            focus={focus}
            colorOf={colorOf}
          />
          {board.agents.map((a) => {
            const row = layout.rows.get(a.id);
            const loose = board.loose.filter((x) => x.agentId === a.id);
            if (!row || loose.length === 0) return null;
            const y = laneY(row, 0) + BAR_H / 2;
            return (
              <ActionTicks key={a.id} actions={loose} layout={layout} t={t} y={y} color="var(--faint)" grey />
            );
          })}
          {board.tasks.map((k) => (
            <TaskBar
              key={k.id}
              k={k}
              nextX={nextX.get(k.id) ?? layout.width}
              layout={layout}
              t={t}
              color={colorOf(k.agentId)}
              catches={board.catches}
              highlight={highlight}
              selected={selected === k.id}
              dim={focus !== null && focus !== k.agentId}
              onSelect={toggle}
            />
          ))}
          <GraphShared shared={board.shared} lookup={lookup} t={t} colorOf={colorOf} onSelect={toggle} />
          <GraphCatches
            catches={board.catches}
            lookup={lookup}
            t={t}
            selected={selected}
            highlight={highlight}
          />
          <NowLine x={nowX} height={layout.height} />
          <VerifyBadges verifies={board.verifies} lookup={lookup} t={t} />
        </svg>
      </div>
    </div>
  );
}
