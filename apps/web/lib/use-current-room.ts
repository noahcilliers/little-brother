"use client";

import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { api } from "./api";
import { PREF, readPref, writePref } from "./local-pref";

export type Place = { roomId: string | null; sessionId: string | null; section: string | null };

const ROOM = /^\/app\/rooms\/([^/]+)(?:\/([^/]+))?/;
const SESSION = /^\/app\/sessions\/([^/]+)/;

/** Where the app is: the room in the URL, or the room of the session in the URL, or the last room visited. */
export function useCurrentPlace(): Place {
  const path = usePathname();
  const room = path.match(ROOM);
  const sessionId = path.match(SESSION)?.[1] ?? null;
  const session = useQuery(api.sessions.get, sessionId ? { sessionId } : "skip");
  const rooms = useQuery(api.rooms.mine);
  const fromUrl = room?.[1] ?? session?.room.id ?? null;
  useEffect(() => {
    if (fromUrl) writePref(PREF.lastRoom, fromUrl);
  }, [fromUrl]);
  const last = readPref(PREF.lastRoom);
  const fallback = rooms?.find((r) => r.id === last)?.id ?? rooms?.[0]?.id ?? null;
  return {
    roomId: fromUrl ?? fallback,
    sessionId,
    section: sessionId ? "sessions" : room ? (room[2] ?? "sessions") : null,
  };
}
