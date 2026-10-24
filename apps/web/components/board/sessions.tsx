"use client";

import { type CSSProperties, useEffect, useRef } from "react";
import type { BoardAgent, BoardSession, SessionLine } from "@/lib/api";
import { elapsed } from "@/lib/format";

type Props = {
  agents: BoardAgent[];
  sessions: BoardSession[];
  t: number;
  start: number;
  selected: string | null;
  onSelect: (taskId: string) => void;
  colorOf: (agentId: string) => string;
};

const CLASS: Partial<Record<SessionLine["kind"], string>> = {
  prompt: "prompt",
  task: "task",
  done: "task",
  fail: "bad",
  ok: "good",
  decide: "good",
};
const PREFIX: Partial<Record<SessionLine["kind"], string>> = {
  prompt: "› ",
  tool: "⏺ ",
  ok: "⏺ ",
  fail: "⏺ ",
  decide: "⏺ ",
};

function LineBody({ l }: { l: SessionLine }) {
  if (l.kind === "lb" || l.kind === "lbwarn") {
    const color = l.kind === "lb" ? "var(--hot)" : l.head === "decided" ? "var(--ink)" : "var(--warn)";
    return (
      <div className="lb" style={{ color }}>
        <b>little brother · {l.head}</b>
        <span style={{ color: "var(--ink)" }}>{l.text}</span>
      </div>
    );
  }
  return (
    <span className={CLASS[l.kind]}>
      {PREFIX[l.kind] ?? ""}
      {l.text}
    </span>
  );
}

function Pane({
  agent,
  lines,
  start,
  selected,
  onSelect,
  color,
}: Omit<Props, "agents" | "sessions" | "t" | "colorOf"> & {
  agent: BoardAgent;
  lines: SessionLine[];
  color: string;
}) {
  const list = useRef<HTMLOListElement>(null);
  const count = useRef(0);
  const grew = lines.length > count.current;
  useEffect(() => {
    count.current = lines.length;
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [lines.length]);
  return (
    <section className="sess">
      <header>
        <i style={{ background: color }} />
        <span className="sess-name" title={agent.name}>
          {agent.name}
        </span>
        <small title={agent.branch}>claude code · {agent.branch}</small>
      </header>
      <ol ref={list}>
        {lines.map((l, i) => (
          // biome-ignore lint/a11y/useKeyWithClickEvents: the same task is reachable from its bar in the graph
          <li
            key={l.id}
            className={[
              l.task && l.task === selected ? "on" : "",
              grew && i === lines.length - 1 ? "enter" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => (l.task ? onSelect(l.task) : undefined)}
          >
            <time>{elapsed(l.t, start)}</time>
            <LineBody l={l} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Each agent's Claude Code session as its developer sees it, in step with the graph's time. */
export function Sessions({ agents, sessions, t, start, selected, onSelect, colorOf }: Props) {
  return (
    <div className="sessions" style={{ "--cols": Math.min(3, agents.length) } as CSSProperties}>
      {agents.map((a) => (
        <Pane
          key={a.id}
          agent={a}
          lines={(sessions.find((s) => s.agentId === a.id)?.lines ?? []).filter((l) => l.t <= t)}
          start={start}
          selected={selected}
          onSelect={onSelect}
          color={colorOf(a.id)}
        />
      ))}
    </div>
  );
}
