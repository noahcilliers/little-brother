"use client";

import type { ReplayEvent } from "@lb/core";
import { type RefObject, useCallback, useEffect, useState } from "react";

// Real gaps between lines, compressed: a 90 s run replays in roughly 10 s, but no line waits so long that
// the terminal looks stuck, nor flashes past too fast to read.
const SPEEDUP = 8;
const MIN_GAP_MS = 140;
const MAX_GAP_MS = 900;

const gapAfter = (events: ReplayEvent[], i: number): number => {
  const cur = events[i];
  const next = events[i + 1];
  if (!cur || !next) return MIN_GAP_MS;
  return Math.min(MAX_GAP_MS, Math.max(MIN_GAP_MS, (next.t - cur.t) / SPEEDUP));
};

/**
 * How many replay lines are showing. Starts once the terminal is on screen; with reduced motion every line
 * shows at once.
 */
export function useReplay(events: ReplayEvent[], target: RefObject<HTMLElement | null>) {
  const [shown, setShown] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(events.length);
      return;
    }
    const el = target.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setStarted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [events, target]);

  useEffect(() => {
    if (!started || shown >= events.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 300 : gapAfter(events, shown - 1));
    return () => clearTimeout(id);
  }, [started, shown, events]);

  const restart = useCallback(() => {
    setShown(0);
    setStarted(true);
  }, []);

  return { shown, done: shown >= events.length, restart };
}
