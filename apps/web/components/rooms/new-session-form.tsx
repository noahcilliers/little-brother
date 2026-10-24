"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type RoomId } from "@/lib/api";
import { useAction } from "@/lib/use-action";

/** Creates a session and opens it, where the join command for Claude Code is waiting. */
export function NewSessionForm({ roomId }: { roomId: RoomId }) {
  const create = useMutation(api.sessions.create);
  const router = useRouter();
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => create({ roomId, name })).then((r) => {
          if (r) router.push(`/app/sessions/${r.sessionId}`);
        });
      }}
    >
      <div className="field-row">
        <input
          aria-label="Session name"
          className="input"
          placeholder="Name the work, e.g. checkout refactor"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn-solid" disabled={busy}>
          {busy ? "Creating…" : "New session"}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}
