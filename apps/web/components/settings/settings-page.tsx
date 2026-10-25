"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api, type Room } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { InviteLink } from "../members/invite-link";
import { RoomPage } from "../rooms/room-page";
import { ConfirmButton } from "../shell/confirm-button";
import { PageHeader } from "../shell/page-header";
import { FormError, Input } from "../ui/field";
import { Section } from "../ui/section";
import { AdmissionChoice } from "./admission-choice";
import { ClassifierChoice } from "./classifier-choice";

function InviteSection({ room }: { room: Room }) {
  const rotate = useMutation(api.rooms.rotateInvite);
  const { busy, error, run } = useAction();
  return (
    <Section
      title="Invite link"
      actions={
        room.isOwner ? (
          <ConfirmButton
            label="Reset link"
            title="Reset the invite link?"
            confirm="The old link stops working. People already in the room stay."
            busy={busy}
            onConfirm={() => void run(() => rotate({ roomId: room.id }))}
          />
        ) : null
      }
    >
      <InviteLink room={room} />
      <FormError error={error} />
    </Section>
  );
}

function LeaveSection({ room }: { room: Room }) {
  const leave = useMutation(api.rooms.leave);
  const router = useRouter();
  const { busy, error, run } = useAction();
  const last = room.members.length <= 1;
  return (
    <Section
      title="Leave room"
      description={
        last ? "You're the last member; leaving ends its sessions." : "You can rejoin with an invite link."
      }
      danger
      actions={
        <ConfirmButton
          label="Leave room"
          title={`Leave ${room.name}?`}
          confirm={
            last ? "You're the last member, so its sessions end." : "You'll need an invite link to come back."
          }
          danger
          busy={busy}
          onConfirm={() =>
            void run(() => leave({ roomId: room.id })).then((r) => r !== undefined && router.push("/app"))
          }
        />
      }
    >
      <FormError error={error} />
    </Section>
  );
}

/** /app/rooms/[roomId]/settings: name, invite link, admission and leaving. */
export function SettingsPage({ roomId }: { roomId: string }) {
  return (
    <RoomPage roomId={roomId}>
      {(room) => (
        <>
          <PageHeader title="Settings" />
          <main className="page page-narrow stack">
            <Section title="Room name">
              <Input value={room.name} readOnly aria-label="Room name" />
            </Section>
            <InviteSection room={room} />
            {room.isOwner ? (
              <Section title="Who gets in">
                <AdmissionChoice room={room} />
              </Section>
            ) : null}
            <Section title="Classifier">
              <ClassifierChoice room={room} />
            </Section>
            <LeaveSection room={room} />
          </main>
        </>
      )}
    </RoomPage>
  );
}
