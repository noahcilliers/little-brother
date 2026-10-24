"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardDecision } from "./api";

/** What the modal shows for a moment after a decision: who the update goes to. */
export type Decided = { decision: BoardDecision; loserHandle?: string; dismissed: boolean; at: number };

/**
 * The queue of conflicts waiting on a person. A new one opens the modal at once; closing it leaves the queue (the
 * top bar pill reopens it). After a decision the modal shows where the update went, then moves on.
 */
export function useDecisions(decisions: BoardDecision[] | undefined) {
  const list = decisions ?? [];
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [decided, setDecided] = useState<Decided | null>(null);
  const seen = useRef(new Set<string>());

  const ids = list.map((d) => d.id).join(",");
  useEffect(() => {
    const fresh = ids.split(",").filter((id) => id && !seen.current.has(id));
    for (const id of fresh) seen.current.add(id);
    const first = fresh[0];
    // `?decisions=later` loads the board with the queue parked in the top-bar pill (screenshots, wall displays).
    const parked = new URLSearchParams(window.location.search).get("decisions") === "later";
    if (first) {
      if (!parked) setOpen(true);
      setCurrentId((cur) => cur ?? first);
    }
  }, [ids]);

  const current = list.find((d) => d.id === currentId) ?? list[0];
  const index = current ? list.indexOf(current) : -1;
  return {
    open: open && (current !== undefined || decided !== null),
    current,
    index,
    count: list.length,
    decided,
    show: (id?: string) => {
      if (id) setCurrentId(id);
      setOpen(true);
    },
    close: () => setOpen(false),
    step: (by: number) => {
      const next = list[(index + by + list.length) % Math.max(1, list.length)];
      if (next) setCurrentId(next.id);
    },
    markDecided: (d: Decided) => setDecided(d),
    /** After the delivery note: on to the next decision, or closed when none is left. */
    finish: () => {
      setDecided(null);
      setCurrentId(null);
      if (list.filter((d) => d.id !== decided?.decision.id).length === 0) setOpen(false);
    },
  };
}

export type DecisionQueue = ReturnType<typeof useDecisions>;
