"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AskItem } from "@/lib/api";
import {
  type AskAnswer,
  ago,
  choose,
  chooseOther,
  emptyPick,
  isAnswered,
  minutesLeft,
  type Pick,
  toAnswers,
} from "@/lib/ask-form";
import { QuestionOptions } from "./question-options";

type Props = {
  item: AskItem;
  now: number;
  open: boolean;
  busy: boolean;
  error: string | null;
  /** Other questions waiting behind this one. */
  more: number;
  onSubmit: (answers: AskAnswer[]) => void;
  onMinimize: () => void;
};

const isTyping = (t: EventTarget | null) => t instanceof HTMLInputElement && t.type === "text";

/**
 * An agent's AskUserQuestion, answered here instead of in its terminal: a tab per question, numbered options,
 * Other. Keys: 1–9 pick, ←/→ switch question, Enter send (or go to the next unanswered one), Esc answer later.
 * It stays mounted while minimised so a half-made answer survives.
 */
export function QuestionCard({ item, now, open, busy, error, more, onSubmit, onMinimize }: Props) {
  const qs = item.questions;
  const [tab, setTab] = useState(0);
  const [picks, setPicks] = useState<Pick[]>(() => qs.map(emptyPick));
  const otherRef = useRef<HTMLInputElement>(null);
  const q = qs[tab];
  const pick = picks[tab] ?? emptyPick();
  const left = minutesLeft(item.at, now);
  const complete = qs.every((_, i) => isAnswered(picks[i]));
  const ready = complete && left > 0 && !busy;

  const update = useCallback(
    (i: number, p: Pick) => setPicks((all) => all.map((x, j) => (j === i ? p : x))),
    [],
  );
  const send = useCallback(() => {
    const next = qs.findIndex((_, i) => !isAnswered(picks[i]));
    if (next >= 0) setTab(next);
    else if (ready) onSubmit(toAnswers(qs, picks));
  }, [qs, picks, ready, onSubmit]);

  useEffect(() => {
    if (!open || !q) return;
    // Capture phase, so the decision modal's 1/2 keys and the task popup's Esc never fire under this card.
    const onKey = (e: KeyboardEvent) => {
      const typing = isTyping(e.target);
      if (e.key === "Escape") onMinimize();
      else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) send();
      else if (!typing && /^[1-9]$/.test(e.key)) {
        const n = Number(e.key) - 1;
        const multi = q.multiSelect === true;
        const label = q.options[n]?.label;
        if (label !== undefined) update(tab, choose(pick, label, multi));
        else if (n === q.options.length) {
          update(tab, chooseOther(pick, multi, true));
          otherRef.current?.focus();
        } else return;
      } else if (!typing && (e.key === "ArrowRight" || e.key === "ArrowLeft") && qs.length > 1) {
        setTab((i) => (i + (e.key === "ArrowRight" ? 1 : qs.length - 1)) % qs.length);
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, q, qs.length, tab, pick, update, send, onMinimize]);

  if (!q) return null;
  return (
    <div className="ask-scrim" hidden={!open}>
      <div className="ask card" role="dialog" aria-modal="true" aria-labelledby="ask-title">
        <header className="ask-head">
          <span className="ask-mark" aria-hidden="true">
            ?
          </span>
          <b id="ask-title">Your agent asks</b>
          {more > 0 ? <span className="ask-more">+{more} waiting</span> : null}
          <button type="button" className="ask-min" onClick={onMinimize} aria-label="Answer later">
            –
          </button>
        </header>
        {qs.length > 1 ? (
          <div className="ask-tabs" role="tablist" aria-label="Questions">
            {qs.map((x, i) => (
              <button
                key={x.question}
                type="button"
                role="tab"
                aria-selected={i === tab}
                className={isAnswered(picks[i]) ? "done" : undefined}
                onClick={() => setTab(i)}
              >
                <i aria-hidden="true">{isAnswered(picks[i]) ? "✓" : ""}</i>
                {x.header || `Question ${i + 1}`}
              </button>
            ))}
          </div>
        ) : q.header ? (
          <span className="ask-chip">{q.header}</span>
        ) : null}
        <QuestionOptions q={q} index={tab} pick={pick} onChange={(p) => update(tab, p)} otherRef={otherRef} />
        <p className="ask-meta">
          {item.branch ? `Your agent on ${item.branch}` : "Your agent"} asked {ago(now - item.at)}
          {" · "}
          {left > 0
            ? `answer within ~${left} min or it falls back to the terminal`
            : "timed out: it asks in the terminal now"}
        </p>
        {error ? <p className="ask-error">{error}</p> : null}
        <footer className="ask-foot">
          <span className="ask-keys">
            <kbd>1–9</kbd> pick <kbd>Enter</kbd> send <kbd>Esc</kbd> later
          </span>
          <button
            type="button"
            className="button button-primary button-md"
            disabled={busy || left === 0 || (qs.length === 1 && !complete)}
            onClick={send}
          >
            {busy ? "Sending…" : complete ? "Send" : "Next"}
          </button>
        </footer>
      </div>
    </div>
  );
}
