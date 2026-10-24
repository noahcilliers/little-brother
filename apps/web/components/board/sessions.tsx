"use client";

import { type CSSProperties, useEffect, useRef } from "react";
import type { BoardSession, SessionLine } from "@/lib/api";
import { agentColor, elapsed } from "@/lib/format";

type Props = {
  sessions: BoardSession[];
  t: number;
  start: number;
  selected: string | null;
  onSelect: (taskId: string) => void;
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
  session,
  lines,
  start,
  selected,
  onSelect,
}: Omit<Props, "sessions" | "t"> & {
  session: BoardSession;
  lines: SessionLine[];
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
        <i style={{ background: agentColor(session.color) }} />
        <span className="sess-name" title={session.name}>
          {session.name}
        </span>
        <small title={session.branch || undefined}>
          {session.branch ? `claude code · ${session.branch}` : "claude code"}
        </small>
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

/** Each live Claude Code session as its developer sees it, in step with the graph's time. */
export function Sessions({ sessions, t, start, selected, onSelect }: Props) {
  return (
    <div className="sessions" style={{ "--cols": Math.min(3, sessions.length) } as CSSProperties}>
      {sessions.map((s) => (
        <Pane
          key={s.agentId}
          session={s}
          lines={s.lines.filter((l) => l.t <= t)}
          start={start}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
