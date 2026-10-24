"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api, type RoomId } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { WaitingForHost } from "../rooms/waiting-for-host";
import { Step, type StepState } from "./step";

type Props = { state: StepState; enabled: boolean; invite: string | null; handle: string | null };

function InviteJoin({ invite, onJoined }: { invite: string; onJoined: (id: RoomId) => void }) {
  const room = useQuery(api.rooms.preview, { invite });
  const mine = useQuery(api.rooms.mine);
  const join = useMutation(api.rooms.join);
  const { busy, error, run } = useAction();
  const [waiting, setWaiting] = useState(false);
  if (room === undefined) return <p className="hint">Checking the invite…</p>;
  if (room === null)
    return <p className="error">That invite link is no longer valid. Ask the room owner for a new one.</p>;
  if (mine?.some((r) => r.id === room.id)) {
    return (
      <p>
        You're in <b>{room.name}</b>.
      </p>
    );
  }
  return (
    <div className="row">
      <p>
        You were invited to <b>{room.name}</b>.
      </p>
      <button
        type="button"
        className="btn inv"
        disabled={busy || waiting}
        onClick={() =>
          void run(() => join({ invite })).then((r) => {
            if (r?.status === "member") onJoined(r.roomId);
            else if (r) setWaiting(true);
          })
        }
      >
        {busy ? "Asking…" : `Join ${room.name}`}
      </button>
      {waiting ? <WaitingForHost roomId={room.id} name={room.name} /> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

function CreateRoom({ handle, onCreated }: { handle: string; onCreated: (id: RoomId) => void }) {
  const create = useMutation(api.rooms.create);
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => create({ name })).then((r) => r && onCreated(r.roomId));
      }}
    >
      <p>Create a room for your team. You'll get an invite link to send them.</p>
      <input
        aria-label="Room name"
        placeholder={`${handle}'s room`}
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className="btn inv" disabled={busy}>
        {busy ? "Creating…" : "Create room"}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

/** Step 3: join the room an invite points at, or create a first room; anyone with rooms can skip. */
export function StepRooms({ state, enabled, invite, handle }: Props) {
  const mine = useQuery(api.rooms.mine);
  const [room, setRoom] = useState<RoomId | null>(null);
  const target = room ?? (invite ? null : (mine?.[0]?.id ?? null));
  const body = (() => {
    if (!enabled || !handle) return <p className="hint">Sign in first.</p>;
    if (invite) return <InviteJoin invite={invite} onJoined={setRoom} />;
    if (room) return <p>Room created. Open it to start a session and copy its invite link.</p>;
    if (mine && mine.length > 0)
      return (
        <p>
          You're in {mine.length} room{mine.length === 1 ? "" : "s"}. Open the dashboard to start a session,
          or create another room there.
        </p>
      );
    return <CreateRoom handle={handle} onCreated={setRoom} />;
  })();
  return (
    <Step id="rooms" n={3} title="Rooms" state={state}>
      {body}
      <div className="row">
        <a className={state === "done" ? "btn inv" : "btn"} href={target ? `/app/rooms/${target}` : "/app"}>
          Open dashboard
        </a>
      </div>
    </Step>
  );
}
