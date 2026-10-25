"use client";

import { useQuery } from "convex/react";
import { useRef } from "react";
import { api, type SessionId } from "@/lib/api";
import { useArrivals } from "@/lib/use-arrivals";
import { useToast } from "../shell/toasts";

const TITLE: Record<string, string> = {
  "outdated-connector": "Outdated connector",
  "not-in-session": "Events dropped",
  "join-failed": "Join failed",
  removed: "Member removed",
};

// A failing judge logs once per classification; one quiet notice per window says it all.
const JUDGE_QUIET_MS = 10 * 60_000;

/**
 * The judge notice. Rate limits are routine on a free-tier key and the cascade keeps classifying without the
 * judge, so it reads as information, not an error. The log line doesn't name the provider, so neither do we.
 */
function judgeNotice(text: string): { title: string; body: string } {
  // classify/run.ts writes exactly this reason for a 429 or RESOURCE_EXHAUSTED.
  if (text.includes("rate limited (429)")) {
    return {
      title: "Judge model is rate-limited",
      body: "Rules and our model are still classifying; failed calls retry once the limit resets.",
    };
  }
  return {
    title: "Judge calls are failing",
    body: "Rules and our model are still classifying. The server log has the error.",
  };
}

/** Host only: server warnings (judge failures, outdated connectors, failed joins) pop up as toasts. */
export function ServerAlerts({ sessionId, onOpenLog }: { sessionId: SessionId; onOpenLog: () => void }) {
  const alerts = useQuery(api.dashboard.alerts, { sessionId });
  const toast = useToast();
  const lastJudge = useRef(0);
  useArrivals(
    alerts,
    (a) => a.id,
    (a) => {
      const action = { label: "Server log", run: onOpenLog };
      if (a.kind === "judge-failed") {
        const now = Date.now();
        if (now - lastJudge.current < JUDGE_QUIET_MS) return;
        lastJudge.current = now;
        // One id per session, so a burst replaces the notice instead of stacking copies.
        toast({ id: `srv:judge:${sessionId}`, tone: "info", ...judgeNotice(a.text), action });
        return;
      }
      toast({
        id: `srv:${a.id}`,
        tone: a.level === "error" ? "conflict" : "warn",
        title: TITLE[a.kind] ?? a.kind,
        body: a.text,
        action,
      });
    },
  );
  return null;
}
