"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { layoutBoard } from "@/lib/board-layout";
import { agentColor } from "@/lib/format";
import { usePlayback } from "@/lib/use-playback";
import { AgentsPanel } from "./agents-panel";
import { BehaviorGraph } from "./behavior-graph";
import { EventsPanel } from "./events-panel";
import { PlaybackBar } from "./playback-bar";
import { SelectedPanel } from "./selected-panel";
import { TopBar } from "./top-bar";

/** The whole dashboard: one behavior graph of every agent, with agents, selection and events beside it. */
export function Board() {
  const board = useQuery(api.dashboard.board);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const layout = useMemo(
    () => (board ? layoutBoard(board.agents, board.nodes, Date.now()) : undefined),
    [board],
  );
  const play = usePlayback(layout?.axis);
  const colors = useMemo(() => new Map(board?.agents.map((a) => [a.id, a.color])), [board]);
  const colorOf = (agentId: string | null) => agentColor(agentId ? colors.get(agentId) : undefined);
  const start = layout?.axis.start ?? 0;

  return (
    <div className="app">
      <TopBar board={board} t={play.t} />
      <div className="grid">
        <div className="card graph">
          {board && layout ? (
            board.nodes.length > 0 ? (
              <BehaviorGraph
                board={board}
                layout={layout}
                t={play.t}
                live={play.mode === "live"}
                selected={selected}
                focus={focus}
                onSelect={setSelected}
                colorOf={colorOf}
              />
            ) : (
              <p className="empty">
                No activity yet. Each Claude Code session with the plugin shows up here.
              </p>
            )
          ) : (
            <p className="empty">Connecting…</p>
          )}
        </div>
        {board ? (
          <aside className="side">
            <AgentsPanel
              board={board}
              t={play.t}
              now={play.now}
              live={play.mode === "live"}
              focus={focus}
              onFocus={setFocus}
            />
            <SelectedPanel
              board={board}
              selected={selected}
              t={play.t}
              start={start}
              onSelect={setSelected}
              colorOf={colorOf}
            />
            <EventsPanel board={board} t={play.t} start={start} onSelect={setSelected} colorOf={colorOf} />
          </aside>
        ) : null}
      </div>
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
