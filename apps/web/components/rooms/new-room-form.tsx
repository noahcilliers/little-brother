"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";

/** Creates a room and opens it, so the next thing you see is its invite link and "New session". */
export function NewRoomForm() {
  const create = useMutation(api.rooms.create);
  const router = useRouter();
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => create({ name })).then((r) => {
          if (r) router.push(`/app/rooms/${r.roomId}`);
        });
      }}
    >
      <label className="field-label" htmlFor="new-room">
        New room
      </label>
      <div className="field-row">
        <input
          id="new-room"
          className="input"
          placeholder="e.g. payments-team"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn-solid" disabled={busy}>
          {busy ? "Creating…" : "Create room"}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}
