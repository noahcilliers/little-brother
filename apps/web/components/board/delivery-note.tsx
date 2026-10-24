"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { Decided } from "@/lib/use-decisions";

// The note stays this long once the update is in the other session, and never longer than MAX_MS overall.
const HOLD_MS = 2500;
const MAX_MS = 8000;

/** After a decision: whether the update reached the other side's session yet, read from its inbox item. */
export function DeliveryNote({ decided, onDone }: { decided: Decided; onDone: () => void }) {
  const items = useQuery(api.dashboard.delivery, { classificationId: decided.decision.classificationId });
  // Only the items the decision itself queued; earlier warnings on the same conflict were delivered long ago.
  const fresh = items?.filter((i) => i.at >= decided.at - 5000);
  const loser =
    fresh?.find((i) => i.action === "block") ?? fresh?.find((i) => i.handle === decided.loserHandle);
  const delivered = loser !== undefined && loser.state !== "queued";

  // The board re-renders several times a second; the timer must not restart with it.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const id = setTimeout(() => done.current(), decided.dismissed ? 1200 : delivered ? HOLD_MS : MAX_MS);
    return () => clearTimeout(id);
  }, [delivered, decided.dismissed]);

  if (decided.dismissed) return <p className="delivery">Dismissed as compatible. Both sides carry on.</p>;
  const who = loser?.handle ?? decided.loserHandle ?? "the other";
  return (
    <p className={delivered ? "delivery done" : "delivery"}>
      {delivered
        ? `Delivered to ${who}'s session`
        : `Queued for ${who}'s session · delivered on its next step`}
    </p>
  );
}
