"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";

/**
 * Element fullscreen for the film. `supported` is false where the browser has no element fullscreen (iPhone
 * Safari), so the button is hidden rather than doing nothing. `f` toggles it, like video players.
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(document.fullscreenEnabled);
    const sync = () => setOn(document.fullscreenElement === ref.current && ref.current !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [ref]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen().catch(() => undefined);
  }, [ref]);

  useEffect(() => {
    if (!supported) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable]");
      if (e.key === "f" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [supported, toggle]);

  return { on, supported, toggle };
}
