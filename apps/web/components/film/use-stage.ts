"use client";

import { type RefObject, useEffect, useMemo, useState } from "react";
import { type Geometry, GUESS, measure, shots } from "./film-camera";

/** Width of the viewport the stage is scaled into. */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(GUESS.w);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** The rendered stage's geometry and the camera's shot list; re-measured when the stage resizes (fonts, theme). */
export function useStage(ref: RefObject<HTMLElement | null>) {
  const [geo, setGeo] = useState<Geometry>(GUESS);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setGeo(measure(el));
    const ro = new ResizeObserver(() => setGeo(measure(el)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  const list = useMemo(() => shots(geo), [geo]);
  return { geo, list };
}
