"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api, type OpenConflict } from "@/lib/api";

/** An open conflict is decided here: keep one side (the other is superseded) or dismiss it as a false alarm. */
export function ResolveActions({ conflict }: { conflict: OpenConflict }) {
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
    <div className="resolve">
      <p className="note">{conflict.reason}</p>
      {conflict.comparison ? <pre className="compare">{conflict.comparison}</pre> : null}
      <div className="actions">
        {[conflict.a, conflict.b].map((side) => (
          <button
            key={side.nodeId}
            type="button"
            className="ctl"
            disabled={busy}
            onClick={() => run(() => approve({ classificationId, keepNodeId: side.nodeId }))}
          >
            Keep {side.handle}: {side.label}
          </button>
        ))}
        <button
          type="button"
          className="ctl quiet"
          disabled={busy}
          onClick={() => run(() => dismiss({ classificationId }))}
        >
          Dismiss
        </button>
      </div>
      {error ? <p className="note hot">{error}</p> : null}
    </div>
  );
}
