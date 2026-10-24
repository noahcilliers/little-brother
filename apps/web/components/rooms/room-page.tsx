"use client";

import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api, type Room } from "@/lib/api";
import { PageState } from "../shell/page-state";
import { ButtonLink } from "../ui/button";

/** Loads the room in the URL and hands it to the page; loading and not-found look the same everywhere. */
export function RoomPage({ roomId, children }: { roomId: string; children: (room: Room) => ReactNode }) {
  const room = useQuery(api.rooms.get, { roomId });
  if (room === undefined) return <PageState title="Loading" loading />;
  if (room === null)
    return (
      <PageState title="Room not found">
        <p>It doesn't exist, or you're not a member.</p>
        <ButtonLink href="/app">Back to your rooms</ButtonLink>
      </PageState>
    );
  return <>{children(room)}</>;
}
