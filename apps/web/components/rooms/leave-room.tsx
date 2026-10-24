"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api, type RoomId } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { ConfirmButton } from "../shell/confirm-button";

/** Leaving hands ownership on; the last member out closes the room's sessions. */
export function LeaveRoom({ roomId, last }: { roomId: RoomId; last: boolean }) {
  const leave = useMutation(api.rooms.leave);
  const router = useRouter();
  const { busy, error, run } = useAction();
  return (
    <>
      <ConfirmButton
        label="Leave room"
        confirm={last ? "You're the last member; its sessions end. Leave?" : "Leave this room?"}
        danger
        busy={busy}
        onConfirm={() =>
          void run(() => leave({ roomId })).then((r) => {
            if (r !== undefined) router.push("/app");
          })
        }
      />
      {error ? <p className="form-error">{error}</p> : null}
    </>
  );
}
