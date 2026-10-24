"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api, type SessionId } from "@/lib/api";
import { fromClassifier, fromServer, newestFirst } from "@/lib/log-rows";
import { EmptyState } from "../ui/empty-state";
import { LogsPanel } from "./logs-panel";

/** The classifier's verdicts for one session, by session id (members) or watch token (read-only view). */
export function ClassifierLogs({ sessionId, watchToken }: { sessionId?: SessionId; watchToken?: string }) {
  const member = useQuery(api.dashboard.log, sessionId ? { sessionId } : "skip");
  const watched = useQuery(api.watch.log, watchToken ? { token: watchToken } : "skip");
  const steps = watchToken ? watched : member;
  const rows = useMemo(
    () => (steps ? newestFirst(fromClassifier(steps)) : steps === null ? [] : undefined),
    [steps],
  );
  return (
    <LogsPanel
      rows={rows}
      sources={["classifier"]}
      empty="Nothing judged yet. Verdicts land here as people work."
    />
  );
}

/** Host only: hooks as they arrived and what the server did with them. */
export function ServerLogs({ sessionId }: { sessionId: SessionId }) {
  const data = useQuery(api.dashboard.serverLog, { sessionId });
  const rows = useMemo(() => (data ? fromServer(data) : undefined), [data]);
  if (data === null) return <EmptyState icon="logs" title="Only the room's host sees the server log." />;
  return (
    <LogsPanel rows={rows} sources={["hook", "server"]} empty="No hooks received for this session yet." />
  );
}
