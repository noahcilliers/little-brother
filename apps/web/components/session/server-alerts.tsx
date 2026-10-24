"use client";

import { useQuery } from "convex/react";
import { api, type SessionId } from "@/lib/api";
import { useArrivals } from "@/lib/use-arrivals";
import { useToast } from "../shell/toasts";

const TITLE: Record<string, string> = {
  "judge-failed": "Classifier judge failed",
  "outdated-connector": "Outdated connector",
  "not-in-session": "Events dropped",
  "join-failed": "Join failed",
  removed: "Member removed",
};

/** Host only: server warnings (judge failures, outdated connectors, failed joins) pop up as toasts. */
export function ServerAlerts({ sessionId, onOpenLog }: { sessionId: SessionId; onOpenLog: () => void }) {
  const alerts = useQuery(api.dashboard.alerts, { sessionId });
  const toast = useToast();
  useArrivals(
    alerts,
    (a) => a.id,
    (a) =>
      toast({
        id: `srv:${a.id}`,
        tone: a.level === "error" ? "conflict" : "warn",
        title: TITLE[a.kind] ?? a.kind,
        body: a.text,
        action: { label: "Server log", run: onOpenLog },
      }),
  );
  return null;
}
