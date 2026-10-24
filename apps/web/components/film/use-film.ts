"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { DURATION } from "./film-graph-data";

const START_AT = 27; // a poster frame mid-conflict until the film scrolls into view
const LOOP_HOLD = 2.5;

/** Playback clock: autoplays from 0 when the stage is in view, pauses when it leaves, loops after a hold. */
export function useFilm(stage: RefObject<HTMLElement | null>) {
  const [t, setT] = useState(START_AT);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const s = useRef({ t: START_AT, playing: false, userPaused: false, started: false, hold: 0 });

  const set = useCallback((next: number) => {
    s.current.t = Math.max(0, Math.min(DURATION, next));
    setT(s.current.t);
  }, []);
  const play = useCallback((p: boolean) => {
    s.current.playing = p;
    setPlaying(p);
  }, []);

  useEffect(() => {
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const st = s.current;
      if (st.playing) {
        if (st.t < DURATION) set(st.t + dt);
        else if ((st.hold += dt) > LOOP_HOLD) {
          st.hold = 0;
          set(0);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [set]);

  useEffect(() => {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(still);
    const el = stage.current;
    if (still || !el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const st = s.current;
        if (entry?.isIntersecting && !st.userPaused) {
          if (!st.started) {
            st.started = true;
            set(0);
          }
          play(true);
        } else if (!entry?.isIntersecting) play(false);
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [stage, set, play]);

  const seek = (v: number) => {
    s.current.started = true;
    set(v);
  };
  const toggle = () => {
    const st = s.current;
    if (!st.started) {
      st.started = true;
      set(0);
    }
    if (st.t >= DURATION) set(0);
    st.userPaused = st.playing;
    play(!st.playing);
  };
  const restart = () => {
    s.current.userPaused = false;
    seek(0);
    play(true);
  };
  return { t, playing, reduced, seek, toggle, restart };
}
