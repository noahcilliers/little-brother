"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api, type RoomId } from "@/lib/api";

/** Shown to whoever asked to join: waits live for the host, then goes straight into the room. */
export function WaitingForHost({ roomId, name, next }: { roomId: RoomId; name?: string; next?: string }) {
  const status = useQuery(api.roomAdmin.myStatus, { roomId });
  const router = useRouter();
  useEffect(() => {
    if (status === "member") router.push(next ?? `/app/rooms/${roomId}`);
  }, [status, roomId, router, next]);
  if (status === "denied")
    return <p className="form-error">The host declined your request{name ? ` to join ${name}` : ""}.</p>;
  return (
    <p className="waiting-note" aria-live="polite">
      <span className="pulse-dot" /> Waiting for the host to let you in{name ? ` to ${name}` : ""}…
    </p>
  );
}
