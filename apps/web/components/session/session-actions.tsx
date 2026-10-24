"use client";

import { useMutation } from "convex/react";
import { api, type SessionHead } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { ConfirmButton } from "../shell/confirm-button";

/** Ending stops recording (connectors on the code are ignored); reopening resumes it. */
export function SessionActions({ session }: { session: SessionHead }) {
  const end = useMutation(api.sessions.end);
  const reopen = useMutation(api.sessions.reopen);
  const { busy, error, run } = useAction();
  return (
    <>
      {session.endedAt === null ? (
        <ConfirmButton
          label="End session"
          confirm="Stop recording?"
          danger
          busy={busy}
          onConfirm={() => void run(() => end({ sessionId: session.id }))}
        />
      ) : (
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => void run(() => reopen({ sessionId: session.id }))}
        >
          Reopen session
        </button>
      )}
      {error ? <span className="form-error">{error}</span> : null}
    </>
  );
}
