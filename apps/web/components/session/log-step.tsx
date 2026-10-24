"use client";

import { useState } from "react";
import type { LogStep, LogVerdict } from "@/lib/api";

const time = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const pct = (n: number) => `${Math.round(n * 100)}%`;
const SOURCE: Record<LogVerdict["source"], string> = {
  rule: "rule",
  llm: "judge",
  pair_model: "model",
  fallback: "fallback",
};

function VerdictRow({ v }: { v: LogVerdict }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`log-verdict t-${v.type}`}>
      <button type="button" className="log-verdict-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="log-rel">{v.relation.replace(/_/g, " ")}</span>
        <span className="log-against" title={v.against?.text}>
          {v.against ? (
            <>
              <b>{v.against.handle}</b> {v.against.text}
            </>
          ) : (
            "—"
          )}
        </span>
        <span className="log-meta">
          <span className={`log-src s-${v.source}`}>{SOURCE[v.source]}</span>
          <span>{pct(v.confidence)}</span>
          <span>{v.action}</span>
          <span>{v.latencyMs} ms</span>
        </span>
      </button>
      {open ? (
        <div className="log-why">
          <p>{v.reason || "No reason recorded."}</p>
          {v.evidence.length > 0 ? (
            <ul>
              {v.evidence.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          {v.status !== "open" ? <p className="muted small">status: {v.status}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

/** One step the classifier judged: who did it, what it was, and every comparison it made. */
export function LogStepCard({ step }: { step: LogStep }) {
  const catches = step.verdicts.filter((v) => v.type !== "normal").length;
  return (
    <article className="log-step">
      <header>
        <span className="log-time">{time(step.at)}</span>
        <b>{step.handle}</b>
        <span className="row-tag">{step.kind}</span>
        <span className="log-text" title={step.text}>
          {step.text}
        </span>
        <span className={catches ? "row-tag on" : "row-tag"}>
          {step.verdicts.length} compared{catches ? ` · ${catches} caught` : ""}
        </span>
      </header>
      <ul>
        {step.verdicts.map((v) => (
          <VerdictRow key={v.id} v={v} />
        ))}
      </ul>
    </article>
  );
}
