"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { PREF, readPref } from "@/lib/local-pref";
import { PageState } from "../shell/page-state";

/** /app: straight into the last room visited, or the first one; no rooms yet means onboarding. */
export function AppIndex() {
  const rooms = useQuery(api.rooms.mine);
  const status = useQuery(api.team.status);
  const router = useRouter();
  useEffect(() => {
    if (rooms === undefined || status === undefined) return;
    if (rooms.length === 0) {
      // Local open mode has no account to onboard; it still has the local room.
      if (!status.openMode) router.replace("/onboarding");
      return;
    }
    const last = readPref(PREF.lastRoom);
    router.replace(`/app/rooms/${rooms.find((r) => r.id === last)?.id ?? rooms[0]?.id}`);
  }, [rooms, status, router]);
  if (rooms?.length === 0 && status?.openMode)
    return (
      <PageState title="No rooms">
        <p>Local open mode: open a session by its link, or sign in to create rooms.</p>
      </PageState>
    );
  return <PageState title="Loading" loading />;
}
