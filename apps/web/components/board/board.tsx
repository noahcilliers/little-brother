"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api, type SessionId } from "@/lib/api";
import { layoutBoard } from "@/lib/board-layout";
import type { CatchKind } from "@/lib/board-time";
import { cleanBoard } from "@/lib/clean-label";
import { agentColor } from "@/lib/format";
import { useDecisions } from "@/lib/use-decisions";
import { usePlayback } from "@/lib/use-playback";
import { AgentsPanel } from "./agents-panel";
import { DecisionModal } from "./decision-modal";
import { Graph } from "./graph";
import { PlaybackBar } from "./playback-bar";
import { SelectedPanel } from "./selected-panel";
import { Sessions } from "./sessions";
import { TopBar } from "./top-bar";

/** One session's board: each person's tasks on one time axis, people and the selected task beside it, transcripts below. */
export function Board({ sessionId }: { sessionId: SessionId }) {
  const raw = useQuery(api.dashboard.board, { sessionId });
  const board = useMemo(() => (raw ? cleanBoard(raw) : undefined), [raw]);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<CatchKind | null>(null);
  const layout = useMemo(() => (board ? layoutBoard(board, Date.now()) : undefined), [board]);
  const play = usePlayback(layout?.axis);
  const decisions = useDecisions(board?.decisions);
  const colors = useMemo(() => new Map(board?.agents.map((a) => [a.id, a.color])), [board]);
  const colorOf = (agentId: string) => agentColor(colors.get(agentId));
  const start = layout?.axis.start ?? 0;
  const empty = board !== undefined && board.agents.length === 0;

  return (
    <div className="app">
      <TopBar
        board={board}
        t={play.t}
        highlight={highlight}
        onHighlight={setHighlight}
        waiting={decisions.open ? 0 : decisions.count}
        onOpenDecision={() => decisions.show()}
      />
      <div className="grid">
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
          />
        ) : (
          <div className="card graph">
            {empty ? (
              <p className="empty">No Claude Code session has joined yet.</p>
            ) : (
              <p className="empty">{raw === null ? "This session isn't visible to you." : "Connecting…"}</p>
            )}
          </div>
        )}
        {board ? (
          <div className="side">
            <AgentsPanel board={board} t={play.t} focus={focus} onFocus={setFocus} colorOf={colorOf} />
            <SelectedPanel
              board={board}
              selected={selected}
              t={play.t}
              start={start}
              colorOf={colorOf}
              onOpenDecision={(id) => decisions.show(id)}
            />
          </div>
        ) : null}
      </div>
      {board && !empty ? (
        <Sessions
          agents={board.agents}
          sessions={board.sessions}
          t={play.t}
          start={start}
          selected={selected}
          onSelect={setSelected}
          colorOf={colorOf}
        />
      ) : null}
      <PlaybackBar
        axis={layout?.axis}
        mode={play.mode}
        t={play.t}
        c={play.c}
        onLive={play.live}
        onPause={play.pause}
        onReplay={play.replay}
        onScrub={play.scrub}
      />
      <DecisionModal queue={decisions} colorOf={colorOf} />
    </div>
  );
}
