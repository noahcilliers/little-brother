"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api, type RoomId } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { WaitingForHost } from "../rooms/waiting-for-host";
import { LiveCheck } from "../ui/badge";
import { Button } from "../ui/button";
import { FormError } from "../ui/field";

type Props = { invite: string; onJoined: (id: RoomId) => void; next: (id: RoomId) => string };

/** Arrived from an invite link: name the room, join it (or wait for the host), then move on. */
export function InviteJoin({ invite, onJoined, next }: Props) {
  const room = useQuery(api.rooms.preview, { invite });
  const mine = useQuery(api.rooms.mine);
  const join = useMutation(api.rooms.join);
  const { busy, error, run } = useAction();
  const [waiting, setWaiting] = useState(false);
  if (room === undefined) return <LiveCheck done={false} waiting="Checking the invite…" ok="" />;
  if (room === null) return <FormError error="That invite link is no longer valid. Ask for a new one." />;
  if (mine?.some((r) => r.id === room.id))
    return (
      <div className="stack-sm">
        <LiveCheck done waiting="" ok={`You're in ${room.name}`} />
        <Button variant="primary" onClick={() => onJoined(room.id)}>
          Continue
        </Button>
      </div>
    );
  if (waiting) return <WaitingForHost roomId={room.id} name={room.name} next={next(room.id)} />;
  return (
    <div className="stack-sm">
      <div className="invite-room">
        <span className="room-mark lg" aria-hidden="true">
          {room.name.slice(0, 1).toUpperCase()}
        </span>
        <b>{room.name}</b>
      </div>
      <Button
        variant="primary"
        disabled={busy}
        onClick={() =>
          void run(() => join({ invite })).then((r) => {
            if (r?.status === "member") onJoined(r.roomId);
            else if (r) setWaiting(true);
          })
        }
      >
        {busy ? "Joining…" : `Join ${room.name}`}
      </Button>
      <FormError error={error} />
    </div>
  );
}
