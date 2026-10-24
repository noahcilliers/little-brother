"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { fromClassifier, fromServer, newestFirst } from "@/lib/log-rows";
import { RoomPage } from "../rooms/room-page";
import { PageHeader } from "../shell/page-header";
import { EmptyState } from "../ui/empty-state";
import { LogsPanel } from "./logs-panel";

function RoomLogs({ roomId }: { roomId: string }) {
  const data = useQuery(api.logs.room, { roomId });
  const rows = useMemo(() => {
    if (!data) return undefined;
    const names = new Map(data.sessions.map((s) => [s.id, s.name]));
    const name = (id: string | null | undefined) => (id ? (names.get(id) ?? null) : null);
    return newestFirst([...fromServer(data.server, name), ...fromClassifier(data.classifier, name)]);
  }, [data]);
  if (data === null) return <EmptyState icon="logs" title="Only the room's host sees the room log." />;
  return (
    <LogsPanel
      rows={rows}
      sources={["hook", "server", "classifier"]}
      showSession
      empty="No activity in this room's sessions yet."
    />
  );
}

/** /app/rooms/[roomId]/logs: every recent session in the room, merged. */
export function RoomLogsPage({ roomId }: { roomId: string }) {
  return (
    <RoomPage roomId={roomId}>
      {(room) => (
        <>
          <PageHeader title="Logs" meta={`${room.name} · last 10 sessions`} />
          <main className="page page-full">
            <RoomLogs roomId={room.id} />
          </main>
        </>
      )}
    </RoomPage>
  );
}
