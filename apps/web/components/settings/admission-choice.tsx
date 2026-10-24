"use client";

import { useMutation } from "convex/react";
import { api, type Room } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { FormError } from "../ui/field";

const MODES = [
  { id: "approval", label: "Host approval", hint: "Invite links and join codes ask; you admit each person." },
  { id: "open", label: "Anyone with the link", hint: "People with the link or a join code are in at once." },
] as const;

/** Host only: whether the room has a waiting room. */
export function AdmissionChoice({ room }: { room: Room }) {
  const set = useMutation(api.roomAdmin.setAdmission);
  const { busy, error, run } = useAction();
  return (
    <div className="stack-sm">
      <div className="choices-grid" role="radiogroup" aria-label="Who gets in">
        {MODES.map((m) => (
          <label key={m.id} className="choice-card">
            <input
              type="radio"
              name="admission"
              checked={room.admission === m.id}
              disabled={busy}
              onChange={() => void run(() => set({ roomId: room.id, admission: m.id }))}
            />
            <span>
              <b>{m.label}</b>
              <small>{m.hint}</small>
            </span>
          </label>
        ))}
      </div>
      <FormError error={error} />
    </div>
  );
}
