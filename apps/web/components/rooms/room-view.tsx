"use client";

import { useQuery } from "convex/react";
import { api, asRoomId } from "@/lib/api";
import { AppHeader } from "../shell/app-header";
import { PageState } from "../shell/page-state";
import { InviteCard } from "./invite-card";
import { LeaveRoom } from "./leave-room";
import { MembersCard } from "./members-card";
import { NewSessionForm } from "./new-session-form";
import { SessionRow } from "./session-row";

/** /app/rooms/[roomId]: the room's sessions, with its invite link and members alongside. */
export function RoomView({ roomId }: { roomId: string }) {
  const id = asRoomId(roomId);
  const room = useQuery(api.rooms.get, { roomId: id });
  if (room === undefined)
    return (
      <>
        <AppHeader crumbs={[{ label: "Rooms", href: "/app" }]} />
        <PageState title="Loading room…" />
      </>
    );
  if (room === null)
    return (
      <>
        <AppHeader crumbs={[{ label: "Rooms", href: "/app" }]} />
        <PageState title="Room not found">
          <p>It doesn't exist, or you're not a member. Ask for an invite link.</p>
        </PageState>
      </>
    );
  const open = room.sessions.filter((s) => s.endedAt === null);
  const ended = room.sessions.filter((s) => s.endedAt !== null);
  return (
    <>
      <AppHeader crumbs={[{ label: "Rooms", href: "/app" }, { label: room.name }]}>
        <LeaveRoom roomId={room.id} last={room.members.length <= 1} />
      </AppHeader>
      <main className="page page-split">
        <div className="col">
          <div className="page-head">
            <h1 title={room.name}>{room.name}</h1>
            <p>Each session gets a join code. Teammates run it in Claude Code to share that work here.</p>
          </div>
          <section className="panel">
            <div className="panel-h">
              Sessions <span className="count-pill">{open.length}</span>
            </div>
            <div className="panel-body">
              <NewSessionForm roomId={room.id} />
            </div>
            {open.length > 0 ? (
              <div className="rows">
                {open.map((s) => (
                  <SessionRow key={s.id} s={s} />
                ))}
              </div>
            ) : (
              <p className="muted pad">No open sessions. Create one to get a join code.</p>
            )}
          </section>
          {ended.length > 0 ? (
            <section className="panel">
              <div className="panel-h">
                Ended <span className="count-pill">{ended.length}</span>
              </div>
              <div className="rows">
                {ended.map((s) => (
                  <SessionRow key={s.id} s={s} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <aside className="col">
          <InviteCard room={room} />
          <MembersCard members={room.members} />
        </aside>
      </main>
    </>
  );
}
