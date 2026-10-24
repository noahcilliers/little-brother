"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { AppHeader } from "../shell/app-header";
import { JoinRoomForm } from "./join-room-form";
import { NewRoomForm } from "./new-room-form";
import { RoomCard } from "./room-card";
import { WorkflowSteps } from "./workflow-steps";

/** /app: your rooms, and the two ways to get another one. */
export function RoomsHome() {
  const rooms = useQuery(api.rooms.mine);
  return (
    <>
      <AppHeader crumbs={[{ label: "Rooms" }]} />
      <main className="page page-narrow">
        <div className="page-head">
          <h1>Rooms</h1>
          <p>A room is your team. Sessions inside it are the pieces of work your Claude Code agents share.</p>
        </div>
        {rooms === undefined ? (
          <div className="panel">
            <p className="muted pad">Loading rooms…</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="panel">
            <div className="panel-h">Get started</div>
            <WorkflowSteps />
          </div>
        ) : (
          <div className="panel">
            <div className="panel-h">
              Your rooms <span className="count-pill">{rooms.length}</span>
            </div>
            <div className="rows">
              {rooms.map((r) => (
                <RoomCard key={r.id} room={r} />
              ))}
            </div>
          </div>
        )}
        <div className="panel forms">
          <NewRoomForm />
          <JoinRoomForm />
        </div>
      </main>
    </>
  );
}
