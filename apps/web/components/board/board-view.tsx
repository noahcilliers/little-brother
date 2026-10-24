"use client";

import { useMemo, useRef, useState } from "react";
import type { Board } from "@/lib/api";
import { layoutBoard } from "@/lib/board-layout";
import type { CatchKind } from "@/lib/board-time";
import { agentColor } from "@/lib/format";
import { useCatchToasts } from "@/lib/use-catch-toasts";
import { useDecisions } from "@/lib/use-decisions";
import { usePlayback } from "@/lib/use-playback";
import { useWidth } from "@/lib/use-width";
import { AgentsPanel } from "./agents-panel";
import { DecisionModal } from "./decision-modal";
import { Graph } from "./graph";
import { PlaybackBar } from "./playback-bar";
import { LABEL_W, LABEL_W_COMPACT } from "./row-labels";
import { Sessions } from "./sessions";
import { TaskPopup } from "./task-popup";
import { TopBar } from "./top-bar";

type Props = {
  board: Board | undefined;
  /** What to say while there is no board: still connecting, or not visible to this viewer. */
  missing: string;
  /** The shared watch view: nobody there can decide. */
  readOnly: boolean;
};

// The graph fills its card; below this it scrolls instead of squeezing a session into a phone's width.
const MIN_FIT = 640;
// The card's right padding and borders around the scrolling area.
const CARD_CHROME = 8;
// Below this graph-column width the name column narrows.
const COMPACT_BELOW = 600;

/** One session's board: each person's tasks on one time axis, people beside it, transcripts below. */
export function BoardView({ board, missing, readOnly }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<CatchKind | null>(null);
  const graphCol = useRef<HTMLDivElement>(null);
  const colW = useWidth(graphCol);
  const labelW = colW > 0 && colW < COMPACT_BELOW ? LABEL_W_COMPACT : LABEL_W;
  const fit = colW > 0 ? Math.max(MIN_FIT, colW - labelW - CARD_CHROME) : undefined;
  const layout = useMemo(() => (board ? layoutBoard(board, Date.now(), fit) : undefined), [board, fit]);
  const play = usePlayback(layout?.axis);
  const decisions = useDecisions(board?.decisions);
  const colors = useMemo(() => new Map(board?.agents.map((a) => [a.id, a.color])), [board]);
  const colorOf = (agentId: string) => agentColor(colors.get(agentId));
  const start = layout?.axis.start ?? 0;
  const empty = board !== undefined && board.agents.length === 0;
  useCatchToasts(board, { readOnly, onSelect: setSelected, onDecide: () => decisions.show() });

  return (
    <div className="app">
      <TopBar
        board={board}
        t={play.t}
        highlight={highlight}
        onHighlight={setHighlight}
        waiting={decisions.open || readOnly ? 0 : decisions.count}
        onOpenDecision={() => decisions.show()}
      />
      <div className="grid">
        <div className="graph-col" ref={graphCol}>
          {board && layout && !empty ? (
            <Graph
              board={board}
              layout={layout}
              t={play.t}
              follow={play.mode !== "paused"}
              selected={selected}
              focus={focus}
              highlight={highlight}
              onSelect={setSelected}
              colorOf={colorOf}
              labelW={labelW}
            />
          ) : (
            <div className="card graph">
              <p className="empty">{empty ? "No Claude Code session has joined yet." : missing}</p>
            </div>
          )}
          <PlaybackBar
            axis={layout?.axis}
            mode={play.mode}
            t={play.t}
            c={play.c}
            onLive={play.live}
            onPause={play.pause}
            onReplay={play.replay}
            onResume={play.resume}
            onScrub={play.scrub}
          />
        </div>
        {board ? (
          <div className="side">
            <AgentsPanel board={board} t={play.t} focus={focus} onFocus={setFocus} colorOf={colorOf} />
          </div>
        ) : null}
      </div>
      {board && !empty ? (
        <Sessions
          sessions={board.sessions}
          t={play.t}
          start={start}
          selected={selected}
          onSelect={setSelected}
        />
      ) : null}
      {board ? (
        <TaskPopup
          board={board}
          selected={selected}
          onSelect={setSelected}
          covered={decisions.open}
          t={play.t}
          start={start}
          colorOf={colorOf}
          onOpenDecision={(id) => {
            if (readOnly) return;
            setSelected(null);
            decisions.show(id);
          }}
        />
      ) : null}
      {readOnly ? null : <DecisionModal queue={decisions} colorOf={colorOf} />}
    </div>
  );
}
