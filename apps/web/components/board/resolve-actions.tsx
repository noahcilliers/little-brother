"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api, type BoardCatch } from "@/lib/api";

/** An open conflict is decided here: keep one side (the other is superseded) or dismiss it as a false alarm. */
export function ResolveActions({ conflict }: { conflict: BoardCatch }) {
  const approve = useMutation(api.resolve.approve);
  const dismiss = useMutation(api.resolve.dismiss);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resolve");
    } finally {
      setBusy(false);
    }
  };
  const { classificationId } = conflict;
  return (
    <>
      {conflict.comparison ? <pre className="compare">{conflict.comparison}</pre> : null}
      <div className="choices">
        {conflict.sides.map((side, i) => (
          <button
            key={side.nodeId}
            type="button"
            className={i === 0 ? "primary" : undefined}
            disabled={busy}
            onClick={() => run(() => approve({ classificationId, keepNodeId: side.nodeId }))}
          >
            Keep {side.label}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={() => run(() => dismiss({ classificationId }))}>
          Dismiss
        </button>
      </div>
      {error ? <p className="empty hot">{error}</p> : null}
    </>
  );
}
