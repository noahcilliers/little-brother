"use client";

import { useMutation } from "convex/react";
import { api, type Room } from "@/lib/api";
import { useAction } from "@/lib/use-action";

const MODES = [
  {
    id: "approval",
    label: "Host admits each person",
    hint: "Invite links and join codes only ask; you admit or deny.",
  },
  {
    id: "open",
    label: "Anyone with the link",
    hint: "People who open the invite link or a join code are in at once.",
  },
] as const;

/** Host only: whether the room has a waiting room. */
export function AdmissionCard({ room }: { room: Room }) {
  const set = useMutation(api.roomAdmin.setAdmission);
  const { busy, error, run } = useAction();
  if (!room.isOwner) return null;
  return (
    <section className="panel">
      <div className="panel-h">Who gets in</div>
      <div className="panel-body">
        {MODES.map((m) => (
          <label key={m.id} className="choice">
            <input
              type="radio"
              name="admission"
              checked={room.admission === m.id}
              disabled={busy}
              onChange={() => void run(() => set({ roomId: room.id, admission: m.id }))}
            />
            <span>
              <b>{m.label}</b>
              <small className="muted">{m.hint}</small>
            </span>
          </label>
        ))}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </section>
  );
}
