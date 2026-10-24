"use client";

import { useQuery } from "convex/react";
import { type ReactNode, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { layoutBoard } from "@/lib/board-layout";
import type { CatchKind } from "@/lib/board-time";
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

/** The whole dashboard: every agent's tasks on one time axis, agents and the selected task beside it, sessions below. */
export function Board({ account }: { account?: ReactNode }) {
  const board = useQuery(api.dashboard.board);
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
        account={account}
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
              <p className="empty">
                No agents have connected yet. Each Claude Code session with the plugin shows up here.{" "}
                <a href="/start#connect">Connect a laptop →</a>
              </p>
            ) : (
              <p className="empty">Connecting…</p>
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
