"use client";

import type { EvalReplay, ReplayKind } from "@lb/core";
import { useEffect, useRef } from "react";
import { useReplay } from "./use-replay";

const TAG: Record<ReplayKind, string> = {
  tool: "run",
  edit: "edit",
  test: "test",
  catch: "lb !",
  deny: "lb ✕",
  decision: "lb ✓",
};

const clock = (ms: number) => {
  const s = ms / 1000;
  return `+${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};
const usd = (n: number) => `$${n.toFixed(2)}`;
const kTokens = (n: number) => `${Math.round(n / 1000)}k`;

function Outcome({ replay, on }: { replay: EvalReplay; on: boolean }) {
  const { outcome: o, contrast: c } = replay;
  const merged = o.finalSuccess === true && o.mergeConflict === false;
  return (
    <div className="tl-outcome" data-on={on ? "on" : "off"}>
      <p>
        <b className={merged ? "tl-ok" : undefined}>
          {merged ? "merged ✓ checks pass" : o.mergeConflict ? "merge conflict" : "checks failed"}
        </b>
        <span>
          {usd(o.costUsd)} · {kTokens(o.newTokens)} new tokens · {Math.round(o.wallSec)} s
        </span>
      </p>
      {c ? (
        <p className="tl-contrast">
          <b>
            Same task, Little Brother off: {c.mergeConflicts} of {c.runs} runs hit a merge conflict
          </b>
          <span>
            {usd(c.meanCostUsd)} · {kTokens(c.meanNewTokens)} new tokens per run
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** One eval run's agent logs, replayed as a terminal: every agent interleaved, catches highlighted. */
export function TerminalReplay({ replay, live }: { replay: EvalReplay; live: boolean }) {
  const box = useRef<HTMLOListElement>(null);
  const { shown, done, restart } = useReplay(replay.events, box);

  useEffect(() => {
    const el = box.current;
    // Scroll the log itself, never the page, as lines arrive.
    if (el && shown > 0) el.scrollTop = el.scrollHeight;
  }, [shown]);

  return (
    <figure className="tl-term">
      <figcaption>
        <span className="tl-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="tl-title">
          {replay.caseId} · {replay.model} · {replay.agents.join(", ")}
        </span>
        <button type="button" className="tl-again" onClick={restart} disabled={!done}>
          replay
        </button>
      </figcaption>
      <ol ref={box} className="tl-log" aria-live="off">
        {replay.events.slice(0, shown).map((e, i) => (
          // Lines never reorder within a replay, so the position is a stable key.
          // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
          <li key={i} className={`tl-row k-${e.kind}`}>
            <time>{clock(e.t)}</time>
            <span className="tl-agent">{e.agent}</span>
            <span className="tl-tag">{TAG[e.kind]}</span>
            <span className="tl-text">{e.text}</span>
          </li>
        ))}
        {!done ? <li className="tl-cursor" aria-hidden="true" /> : null}
      </ol>
      <Outcome replay={replay} on={done} />
      <p className="tl-src">
        {live ? "live from Convex" : "bundled snapshot"} · run {replay.runKey}
      </p>
    </figure>
  );
}
