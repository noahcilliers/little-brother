"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Place } from "@/lib/use-current-room";
import { IconButton } from "../ui/button";

/** Phones only: the sidebar collapses into this bar and opens as a sheet. */
export function MobileBar({ place, onMenu }: { place: Place; onMenu: () => void }) {
  const room = useQuery(api.rooms.get, place.roomId ? { roomId: place.roomId } : "skip");
  return (
    <div className="mobile-bar">
      <IconButton icon="menu" label="Open menu" onClick={onMenu} />
      <Link className="wordmark" href="/app">
        little brother<i aria-hidden="true">▍</i>
      </Link>
      {room ? <span className="mobile-room">{room.name}</span> : null}
    </div>
  );
}
