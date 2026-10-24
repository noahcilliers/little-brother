"use client";

import type { Room } from "@/lib/api";
import { inviteLink } from "@/lib/invite";
import { CopyField } from "../shell/copy-field";

/** The room's invite link with one line on what opening it does. */
export function InviteLink({ room }: { room: Room }) {
  if (!room.inviteCode) return <p className="muted">Only members can see the invite link.</p>;
  return (
    <div className="stack-sm">
      <CopyField text={inviteLink(window.location.origin, room.inviteCode)} label="Copy invite link" />
      <p className="field-hint">
        {room.admission === "open"
          ? "Anyone with the link joins after signing in."
          : "People who open it wait for you to admit them."}
      </p>
    </div>
  );
}
