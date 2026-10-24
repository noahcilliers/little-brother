"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { layoutBoard } from "@/lib/board-layout";
import { agentColor } from "@/lib/format";
import { usePlayback } from "@/lib/use-playback";
import { AgentsPanel } from "./agents-panel";
import { Graph } from "./graph";
import { PlaybackBar } from "./playback-bar";
import { SelectedPanel } from "./selected-panel";
import { Sessions } from "./sessions";
import { TopBar } from "./top-bar";

/** The whole dashboard: every agent's tasks on one time axis, agents and the selected task beside it, sessions below. */
export function Board() {
  const board = useQuery(api.dashboard.board);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const layout = useMemo(() => (board ? layoutBoard(board, Date.now()) : undefined), [board]);
  const play = usePlayback(layout?.axis);
  const colors = useMemo(() => new Map(board?.agents.map((a) => [a.id, a.color])), [board]);
  const colorOf = (agentId: string) => agentColor(colors.get(agentId));
  const start = layout?.axis.start ?? 0;
  const empty = board !== undefined && board.agents.length === 0;

  return (
    <div className="app">
      <TopBar board={board} t={play.t} />
      <div className="grid">
        {board && layout && !empty ? (
          <Graph
            board={board}
            layout={layout}
            t={play.t}
            follow={play.mode !== "paused"}
            selected={selected}
            focus={focus}
            onSelect={setSelected}
            colorOf={colorOf}
          />
        ) : (
          <div className="card graph">
            <p className="empty">
              {empty
                ? "No activity yet. Each Claude Code session with the plugin shows up here."
                : "Connecting…"}
            </p>
          </div>
        )}
        {board ? (
          <div className="side">
            <AgentsPanel board={board} t={play.t} focus={focus} onFocus={setFocus} colorOf={colorOf} />
            <SelectedPanel board={board} selected={selected} t={play.t} start={start} colorOf={colorOf} />
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
    </div>
  );
}
