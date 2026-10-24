"use client";

import { Graph } from "@/components/board/graph";
import { Sessions } from "@/components/board/sessions";
import { TopBar } from "@/components/board/top-bar";
import { agentColor } from "@/lib/format";
import { boardAt, FULL_BOARD } from "./film-board";
import { LAYOUT, STAGE_H, STAGE_W } from "./film-camera";
import { at } from "./film-clock";
import { FilmDecision } from "./film-decision";
import { CONFLICT_AT } from "./film-decision-data";
import { POPUP } from "./film-story";

const COLORS = new Map(FULL_BOARD.agents.map((a) => [a.id, a.color]));
const colorOf = (agentId: string) => agentColor(COLORS.get(agentId));
const noop = () => undefined;

/** The real dashboard (top bar, timeline, session panes) drawn from the scripted board at story second s. */
export function FilmStage({ s, transform }: { s: number; transform: string }) {
  const board = boardAt(s);
  const t = at(s);
  return (
    <div className="film-app" style={{ width: STAGE_W, height: STAGE_H, transform }}>
      <TopBar
        board={board}
        t={t}
        highlight={null}
        onHighlight={noop}
        waiting={s >= CONFLICT_AT && s < POPUP.open ? 1 : 0}
        onOpenDecision={noop}
      />
      <Graph
        board={board}
        layout={LAYOUT}
        t={t}
        follow={false}
        selected={null}
        focus={null}
        highlight={null}
        onSelect={noop}
        colorOf={colorOf}
      />
      <Sessions
        agents={board.agents}
        sessions={board.sessions}
        t={t}
        start={LAYOUT.axis.start}
        selected={null}
        onSelect={noop}
        colorOf={colorOf}
      />
      <FilmDecision s={s} />
    </div>
  );
}
