"use client";

import { useState } from "react";
import { RoomPage } from "../rooms/room-page";
import { WaitingRoom } from "../rooms/waiting-room";
import { PageHeader } from "../shell/page-header";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { EmptyState } from "../ui/empty-state";
import { InviteLink } from "./invite-link";
import { MemberList } from "./member-list";

/** /app/rooms/[roomId]/members: requests waiting on the host, then everyone in the room. */
export function MembersPage({ roomId }: { roomId: string }) {
  const [invite, setInvite] = useState(false);
  return (
    <RoomPage roomId={roomId}>
      {(room) => (
        <>
          <PageHeader
            title="Members"
            meta={`${room.members.length} ${room.members.length === 1 ? "person" : "people"}`}
            actions={
              <Button variant="primary" icon="plus" onClick={() => setInvite(true)}>
                Invite
              </Button>
            }
          />
          <main className="page stack">
            <WaitingRoom roomId={room.id} />
            {room.members.length > 0 ? (
              <MemberList room={room} />
            ) : (
              <EmptyState icon="members" title="Nobody has joined this room yet." />
            )}
          </main>
          <Dialog open={invite} onClose={() => setInvite(false)} title={`Invite to ${room.name}`} size="sm">
            <InviteLink room={room} />
          </Dialog>
        </>
      )}
    </RoomPage>
  );
}
