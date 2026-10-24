"use client";

import { useEffect, useState } from "react";
import type { AskItem } from "@/lib/api";
import type { AskAnswer } from "@/lib/ask-form";
import { errorText } from "@/lib/error-text";
import { useToast } from "../shell/toasts";
import { QuestionCard } from "./question-card";

type Props = {
  items: AskItem[];
  onAnswer: (id: AskItem["id"], answers: AskAnswer[]) => Promise<unknown>;
};

/** Ticks once a second while something is waiting, for the "asked … ago" line and the countdown. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/**
 * The oldest waiting question opens by itself; Esc folds it into a pill that reopens it. A newer question opens
 * even if the last one was folded away.
 */
export function QuestionDock({ items, onAnswer }: Props) {
  const toast = useToast();
  const [later, setLater] = useState<string | null>(null);
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiting = items.filter((i) => !sent.has(i.id));
  const now = useNow(waiting.length > 0);
  const current = waiting[0];
  const currentId = current?.id;
  useEffect(() => {
    if (currentId) setError(null);
  }, [currentId]);
  if (!current) return null;
  const open = later !== current.id;

  const submit = async (answers: AskAnswer[]) => {
    setBusy(true);
    setError(null);
    try {
      await onAnswer(current.id, answers);
      setSent((s) => new Set(s).add(current.id));
      toast({ id: `ask:${current.id}`, tone: "ok", title: "Sent to your agent" });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <QuestionCard
        key={current.id}
        item={current}
        now={now}
        open={open}
        busy={busy}
        error={error}
        more={waiting.length - 1}
        onSubmit={(a) => void submit(a)}
        onMinimize={() => setLater(current.id)}
      />
      {open ? null : (
        <button type="button" className="ask-pill" onClick={() => setLater(null)}>
          <i aria-hidden="true" />
          Your agent is waiting for an answer
        </button>
      )}
    </>
  );
}
