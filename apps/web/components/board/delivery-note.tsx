"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { Decided } from "@/lib/use-decisions";

// The note stays this long once the update is in every session, and never longer than MAX_MS overall.
const HOLD_MS = 2500;
const MAX_MS = 8000;

const HEADLINE: Record<Decided["choice"], string> = {
  kept: "Decided",
  dismissed: "Dismissed as compatible",
  released: "Let both continue",
};

/** After a decision: whether each agent's session has the update yet, read live from their inbox items. */
export function DeliveryNote({ decided, onDone }: { decided: Decided; onDone: () => void }) {
  const items = useQuery(api.dashboard.delivery, { classificationId: decided.decision.classificationId });
  // Only the items the decision itself queued; earlier warnings on the same catch were delivered long ago.
  const fresh = items?.filter((i) => i.at >= decided.at - 5000) ?? [];
  const waiting = fresh.filter((i) => i.state === "queued").map((i) => i.handle);
  const delivered = fresh.length > 0 && waiting.length === 0;

  // The board re-renders several times a second; the timer must not restart with it.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const id = setTimeout(() => done.current(), delivered ? HOLD_MS : MAX_MS);
    return () => clearTimeout(id);
  }, [delivered]);

  const who = [...new Set(fresh.map((i) => i.handle))].join(" and ") || decided.loserHandle || "both";
  return (
    <p className={delivered ? "delivery done" : "delivery"}>
      {HEADLINE[decided.choice]} ·{" "}
      {delivered
        ? `delivered to ${who}'s session${fresh.length > 1 ? "s" : ""}`
        : `queued for ${waiting.join(" and ") || who} · delivered on the next step`}
    </p>
  );
}
