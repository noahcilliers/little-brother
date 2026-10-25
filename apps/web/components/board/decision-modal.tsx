"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api, type BoardDecision } from "@/lib/api";
import { conflictTokens } from "@/lib/diff-tokens";
import type { DecisionQueue } from "@/lib/use-decisions";
import { DecisionSide } from "./decision-side";
import { DeliveryNote } from "./delivery-note";
import { InlineIcon } from "./icons";

type Props = { queue: DecisionQueue; colorOf: (agentId: string) => string };

const TITLE: Record<BoardDecision["kind"], string> = {
  conflict: "Conflict",
  duplicate: "Duplicate work",
  stale: "Known failure",
  ordering: "Ordering wait",
};

function seconds(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 1 ? "right after the change" : `${s} s after the change`;
}

/**
 * A catch only a person can settle, shown over the board the moment it is found. The agents wait on this, not on
 * their terminals, and hear the outcome as a message. Keys: 1, 2, Esc.
 */
export function DecisionModal({ queue, colorOf }: Props) {
  const approve = useMutation(api.resolve.approve);
  const dismiss = useMutation(api.resolve.dismiss);
  const release = useMutation(api.resolve.release);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d: BoardDecision | undefined = queue.decided?.decision ?? queue.current;
  // A conflict or duplicate keeps one side; a known failure or an ordering wait can only be let through.
  const keepable = d?.kind === "conflict" || d?.kind === "duplicate";

  const keep = useCallback(
    async (i: number) => {
      const side = d?.sides[i];
      if (!d || !side || busy || queue.decided) return;
      setBusy(true);
      setError(null);
      try {
        await approve({ classificationId: d.classificationId, keepNodeId: side.nodeId });
        const loser = d.sides.find((s) => s.nodeId !== side.nodeId);
        queue.markDecided({ decision: d, loserHandle: loser?.handle, choice: "kept", at: Date.now() });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not resolve");
      } finally {
        setBusy(false);
      }
    },
    [d, busy, queue, approve],
  );
  const settle = useCallback(
    async (choice: "dismissed" | "released") => {
      if (!d || busy || queue.decided) return;
      setBusy(true);
      setError(null);
      try {
        const run = choice === "dismissed" ? dismiss : release;
        await run({ classificationId: d.classificationId });
        queue.markDecided({ decision: d, choice, at: Date.now() });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not settle");
      } finally {
        setBusy(false);
      }
    },
    [d, busy, queue, dismiss, release],
  );

  useEffect(() => {
    if (!queue.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") queue.close();
      else if (e.key === "1" && keepable) void keep(0);
      else if (e.key === "2" && keepable) void keep(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queue, keep, keepable]);

  if (!queue.open || !d) return null;
  const tokens = conflictTokens(d.sides.map((s) => s.preview));
  const [a, b] = d.sides;
  return (
    <div className="overlay">
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="decision-title">
        <header className="mhead">
          <InlineIcon name="bolt" color="var(--hot)" size={18} />
          <h2 id="decision-title">
            {TITLE[d.kind]} on {d.topic}
          </h2>
          {queue.count > 1 && !queue.decided ? (
            <span className="queue">
              <button type="button" onClick={() => queue.step(-1)} aria-label="Previous decision">
                ‹
              </button>
              {queue.index + 1} of {queue.count}
              <button type="button" onClick={() => queue.step(1)} aria-label="Next decision">
                ›
              </button>
            </span>
          ) : null}
          <button type="button" className="close" onClick={queue.close} aria-label="Close (Esc)">
            ✕
          </button>
        </header>
        <div className="mmeta">
          owner: {d.owner ?? "unassigned"} · detected {seconds(d.detectedAfterMs)}
        </div>
        <p className="rationale">{d.rationale}</p>
        <div className="dcols">
          {d.sides.map((s, i) => (
            <DecisionSide
              key={s.nodeId}
              side={s}
              color={colorOf(s.agentId)}
              keyHint={String(i + 1)}
              tokens={tokens[i] ?? []}
            />
          ))}
        </div>
        {d.comparison ? <pre className="compare">{d.comparison}</pre> : null}
        {queue.decided ? (
          <DeliveryNote decided={queue.decided} onDone={queue.finish} />
        ) : (
          <div className="choices">
            {keepable && a ? (
              <button type="button" className="primary" disabled={busy} onClick={() => void keep(0)}>
                <span className="kbd">1</span> Keep {a.keep}
              </button>
            ) : null}
            {keepable && b ? (
              <button type="button" disabled={busy} onClick={() => void keep(1)}>
                <span className="kbd">2</span> Keep {b.keep}
              </button>
            ) : null}
            <button
              type="button"
              className={keepable ? undefined : "primary"}
              disabled={busy}
              onClick={() => void settle("released")}
            >
              {d.kind === "ordering" ? "Let it go ahead now" : "Let both continue"}
            </button>
            <button type="button" disabled={busy} onClick={() => void settle("dismissed")}>
              Not a real {d.kind === "ordering" ? "dependency" : d.kind}
            </button>
            <span className="hint">
              <span className="kbd">Esc</span> decide later
            </span>
          </div>
        )}
        {error ? <p className="empty hot">{error}</p> : null}
      </div>
    </div>
  );
}
