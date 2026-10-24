"use client";

import { useMutation } from "convex/react";
import { api, type Room, type RoomMember } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { Avatar } from "../account/avatar";
import { ConfirmButton } from "../shell/confirm-button";

function RemoveButton({ room, m }: { room: Room; m: RoomMember }) {
  const remove = useMutation(api.roomAdmin.removeMember);
  const { busy, run } = useAction();
  return (
    <ConfirmButton
      label="Remove"
      confirm={`Remove @${m.handle}? Their Claude sessions stop being shared.`}
      danger
      busy={busy}
      onConfirm={() => void run(() => remove({ roomId: room.id, memberId: m.id }))}
    />
  );
}

/** Who is in the room; the host can take people out. */
export function MembersCard({ room }: { room: Room }) {
  return (
    <section className="panel">
      <div className="panel-h">
        Members <span className="count-pill">{room.members.length}</span>
      </div>
      <ul className="people">
        {room.members.map((m) => (
          <li key={m.id}>
            <Avatar src={m.avatarUrl ?? undefined} name={m.handle} size={24} />
            <span className="row-main">
              <b title={m.name}>{m.name}</b>
              <small>@{m.handle}</small>
            </span>
            {m.isHost ? (
              <span className="row-tag">host</span>
            ) : room.isOwner ? (
              <RemoveButton room={room} m={m} />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
