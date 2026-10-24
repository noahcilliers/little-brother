"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api, type RoomId } from "@/lib/api";
import { CreateRoomForm } from "../rooms/create-room-form";
import { JoinRoomForm } from "../rooms/join-room-form";
import { Button } from "../ui/button";
import { Segmented } from "../ui/tabs";
import { InviteJoin } from "./invite-join";
import { type Carry, stepHref } from "./steps";

type Mode = "existing" | "create" | "join";

type Props = { carry: Carry; handle: string | null; onRoom: (id: RoomId) => void };

/** Step 1: a room for the team: one you're already in, a new one, or one you were invited to. */
export function StepWorkspace({ carry, handle, onRoom }: Props) {
  const rooms = useQuery(api.rooms.mine);
  const [picked, setPicked] = useState<Mode | null>(null);
  const [chosen, setChosen] = useState<string | null>(carry.room);
  const has = (rooms?.length ?? 0) > 0;
  const mode: Mode = picked ?? (carry.invite ? "join" : has ? "existing" : "create");
  const options = [
    ...(has ? [{ id: "existing" as const, label: "Your rooms" }] : []),
    { id: "create" as const, label: "Create" },
    { id: "join" as const, label: "Join" },
  ];
  const next = (id: RoomId) => stepHref("connect", { ...carry, room: id });
  const current = chosen ?? rooms?.[0]?.id ?? null;
  return (
    <div className="stack">
      <Segmented label="Workspace" options={options} value={mode} onChange={setPicked} />
      {mode === "existing" ? (
        <div className="stack-sm">
          <div className="choices-grid one" role="radiogroup" aria-label="Your rooms">
            {(rooms ?? []).map((r) => (
              <label key={r.id} className="choice-card">
                <input type="radio" name="room" checked={current === r.id} onChange={() => setChosen(r.id)} />
                <span>
                  <b>{r.name}</b>
                  <small>
                    {r.members} {r.members === 1 ? "member" : "members"} · {r.sessions}{" "}
                    {r.sessions === 1 ? "session" : "sessions"}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <Button variant="primary" disabled={!current} onClick={() => current && onRoom(current as RoomId)}>
            Continue with this room
          </Button>
        </div>
      ) : mode === "create" ? (
        <CreateRoomForm onCreated={onRoom} placeholder={handle ? `${handle}'s team` : "e.g. payments-team"} />
      ) : carry.invite ? (
        <InviteJoin invite={carry.invite} onJoined={onRoom} next={next} />
      ) : (
        <JoinRoomForm onJoined={onRoom} next={next} />
      )}
    </div>
  );
}
