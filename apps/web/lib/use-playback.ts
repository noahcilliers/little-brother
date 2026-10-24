"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TimeAxis } from "./time-axis";

export type Mode = "live" | "paused" | "replay";

// A replay plays compressed time at real speed, but never takes longer than this.
const MAX_REPLAY_MS = 40_000;

/** Live follows the clock; paused and replay hold a position in compressed time that the scrubber drives. */
export function usePlayback(axis: TimeAxis | undefined) {
  const [mode, setMode] = useState<Mode>("live");
  const [now, setNow] = useState(() => Date.now());
  const [c, setC] = useState(0);
  const cRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (mode !== "replay" || !axis) return;
    const speed = Math.max(1, axis.span / MAX_REPLAY_MS);
    let raf = 0;
    let last = performance.now();
    const step = (ts: number) => {
      cRef.current = Math.min(axis.span, cRef.current + (ts - last) * speed);
      last = ts;
      setC(cRef.current);
      if (cRef.current >= axis.span) setMode("live");
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [mode, axis]);

  const hold = useCallback((next: number) => {
    cRef.current = next;
    setC(next);
  }, []);

  const t = mode === "live" || !axis ? now : axis.fromC(c);
  return {
    mode,
    now,
    t,
    c: mode === "live" && axis ? axis.toC(now) : c,
    live: () => setMode("live"),
    pause: () => {
      if (axis) hold(axis.toC(t));
      setMode("paused");
    },
    replay: () => {
      hold(0);
      setMode("replay");
    },
    scrub: (next: number) => {
      hold(next);
      setMode("paused");
    },
  };
}
