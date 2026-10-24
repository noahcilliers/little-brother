"use client";

import { useQuery } from "convex/react";
import { api, type SessionHead } from "@/lib/api";
import { Badge, Dot } from "../ui/badge";

/** Live / idle / ended, from the room's session list (already subscribed by the sidebar). */
export function SessionStatus({ session }: { session: SessionHead }) {
  const room = useQuery(api.rooms.get, { roomId: session.room.id });
  if (session.endedAt !== null) return <Badge>Ended</Badge>;
  const live = room?.sessions.find((s) => s.id === session.id)?.live ?? 0;
  return live > 0 ? (
    <span className="status">
      <Dot tone="ok" pulse /> {live} live
    </span>
  ) : (
    <span className="status muted">
      <Dot /> Idle
    </span>
  );
}
