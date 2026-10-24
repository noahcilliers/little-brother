"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api, type SessionId } from "@/lib/api";
import { cleanBoard } from "@/lib/clean-label";
import { BoardView } from "./board-view";

/** Members read by session id; the shared live view reads by the host's watch token and cannot decide. */
type Source =
  | { sessionId: SessionId; watchToken?: undefined }
  | { watchToken: string; sessionId?: undefined };

/** One session's live board, read for a member or through a watch link. */
export function Board({ sessionId, watchToken }: Source) {
  const member = useQuery(api.dashboard.board, sessionId ? { sessionId } : "skip");
  const watched = useQuery(api.watch.board, watchToken ? { token: watchToken } : "skip");
  const raw = watchToken ? watched : member;
  const board = useMemo(() => (raw ? cleanBoard(raw) : undefined), [raw]);
  return (
    <BoardView
      board={board}
      missing={raw === null ? "This session isn't visible to you." : "Connecting…"}
      readOnly={watchToken !== undefined}
    />
  );
}
