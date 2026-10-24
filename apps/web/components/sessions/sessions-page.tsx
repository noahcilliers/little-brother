"use client";

import { useState } from "react";
import { RoomPage } from "../rooms/room-page";
import { PageHeader } from "../shell/page-header";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { NewSessionDialog } from "./new-session-dialog";
import { SessionsTable } from "./sessions-table";

/** /app/rooms/[roomId]: the room's sessions. */
export function SessionsPage({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <RoomPage roomId={roomId}>
      {(room) => {
        const live = room.sessions.filter((s) => s.endedAt === null).length;
        const create = (
          <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
            New session
          </Button>
        );
        return (
          <>
            <PageHeader
              title="Sessions"
              meta={room.sessions.length > 0 ? `${live} open · ${room.sessions.length} total` : null}
              actions={room.sessions.length > 0 ? create : null}
            />
            <main className="page">
              {room.sessions.length === 0 ? (
                <EmptyState icon="sessions" title="No sessions yet. Create one to get a join code.">
                  {create}
                </EmptyState>
              ) : (
                <SessionsTable room={room} />
              )}
            </main>
            <NewSessionDialog roomId={room.id} open={open} onClose={() => setOpen(false)} />
          </>
        );
      }}
    </RoomPage>
  );
}
