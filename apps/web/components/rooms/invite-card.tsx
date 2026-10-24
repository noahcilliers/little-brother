"use client";

import { useMutation } from "convex/react";
import { api, type Room } from "@/lib/api";
import { inviteLink } from "@/lib/invite";
import { useAction } from "@/lib/use-action";
import { ConfirmButton } from "../shell/confirm-button";
import { CopyField } from "../shell/copy-field";

/** The room's invite link; the owner can reset it when it has leaked or gone stale. */
export function InviteCard({ room }: { room: Room }) {
  const rotate = useMutation(api.rooms.rotateInvite);
  const { busy, error, run } = useAction();
  return (
    <section className="panel">
      <div className="panel-h">Invite link</div>
      <div className="panel-body">
        {room.inviteCode ? (
          <>
            <CopyField text={inviteLink(window.location.origin, room.inviteCode)} label="Copy invite link" />
            <p className="muted small">Anyone with this link can join after signing in with GitHub.</p>
          </>
        ) : (
          <p className="muted small">Only room members can see the invite link.</p>
        )}
        {room.isOwner ? (
          <div className="panel-actions">
            <ConfirmButton
              label="Reset link"
              confirm="Old links stop working. Reset?"
              busy={busy}
              onConfirm={() => void run(() => rotate({ roomId: room.id }))}
            />
          </div>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </section>
  );
}
