"use client";

import { useRouter } from "next/navigation";
import { Dialog } from "../ui/dialog";
import { CreateRoomForm } from "./create-room-form";
import { JoinRoomForm } from "./join-room-form";

export type RoomDialog = "create" | "join" | null;

/** The room switcher's two actions, as small dialogs that open the room when done. */
export function RoomDialogs({ open, onClose }: { open: RoomDialog; onClose: () => void }) {
  const router = useRouter();
  const go = (id: string) => {
    onClose();
    router.push(`/app/rooms/${id}`);
  };
  return (
    <>
      <Dialog open={open === "create"} onClose={onClose} title="Create room" size="sm">
        <CreateRoomForm onCreated={go} />
      </Dialog>
      <Dialog open={open === "join"} onClose={onClose} title="Join room" size="sm">
        <JoinRoomForm onJoined={go} />
      </Dialog>
    </>
  );
}
