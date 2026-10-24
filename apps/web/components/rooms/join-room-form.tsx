"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { parseInvite } from "@/lib/invite";
import { useAction } from "@/lib/use-action";

/** Paste whatever a teammate sent (link or bare code) to join their room. */
export function JoinRoomForm() {
  const join = useMutation(api.rooms.join);
  const router = useRouter();
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  const { busy, error, run } = useAction();
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        const invite = parseInvite(text);
        setBad(invite === null);
        if (!invite) return;
        void run(() => join({ invite })).then((r) => {
          if (r) router.push(`/app/rooms/${r.roomId}`);
        });
      }}
    >
      <label className="field-label" htmlFor="join-room">
        Join with invite link or code
      </label>
      <div className="field-row">
        <input
          id="join-room"
          className="input mono"
          placeholder="https://…/start?invite=… or the code"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn-ghost" disabled={busy || !text.trim()}>
          {busy ? "Joining…" : "Join"}
        </button>
      </div>
      {bad ? <p className="form-error">That doesn't look like an invite link or code.</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}
