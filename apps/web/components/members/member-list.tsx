"use client";

import { useMutation } from "convex/react";
import { api, type Room, type RoomMember } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { Avatar } from "../account/avatar";
import { ConfirmButton } from "../shell/confirm-button";
import { Badge } from "../ui/badge";

function Remove({ room, m }: { room: Room; m: RoomMember }) {
  const remove = useMutation(api.roomAdmin.removeMember);
  const { busy, run } = useAction();
  return (
    <ConfirmButton
      label="Remove"
      title={`Remove @${m.handle}?`}
      confirm="Their Claude Code sessions stop being shared with this room."
      danger
      size="sm"
      busy={busy}
      onConfirm={() => void run(() => remove({ roomId: room.id, memberId: m.id }))}
    />
  );
}

/** Who is in the room; the host can take people out. */
export function MemberList({ room }: { room: Room }) {
  return (
    <ul className="people card">
      {room.members.map((m) => (
        <li key={m.id} className="person">
          <Avatar src={m.avatarUrl ?? undefined} name={m.handle} size={32} />
          <span className="person-text">
            <b title={m.name}>{m.name}</b>
            <small>@{m.handle}</small>
          </span>
          <span className="person-actions">
            {m.isHost ? <Badge>Host</Badge> : room.isOwner ? <Remove room={room} m={m} /> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
