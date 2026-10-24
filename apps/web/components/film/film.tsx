"use client";

import "./film.css";
import { type RefObject, useEffect, useRef, useState } from "react";
import { STAGE_H, STAGE_W, stageTransform } from "./film-camera";
import { lastBefore } from "./film-clock";
import { FilmControls } from "./film-controls";
import { FilmStage } from "./film-stage";
import { CHAPTERS, SCENES } from "./film-story";
import { useFilm } from "./use-film";

/** Width of the stage viewport, so the fixed-size stage can be scaled and zoomed into it. */
function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(STAGE_W);
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

/** The landing page's product video: a scripted run of the real dashboard on lb-demo-shop, three catches. */
export function Film() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const film = useFilm(wrap);
  const s = film.t;
  const scene = lastBefore(SCENES, s);
  const chapter = lastBefore(CHAPTERS, s);
  return (
    <div className="showcase" id="demo">
      <div className="window">
        <div className="chrome">
          <span className="dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>little brother · lb-demo-shop</span>
          <span className="live">live · 3 agents</span>
        </div>
        <div className="film-view" ref={wrap} style={{ aspectRatio: `${STAGE_W} / ${STAGE_H}` }}>
          <div className="film-stage" aria-hidden="true" inert>
            <FilmStage s={s} transform={stageTransform(s, width, film.reduced)} />
          </div>
        </div>
        <p className="film-sub" aria-live="polite">
          <b>{chapter?.[1]}</b>
          <span key={scene?.[0]}>{scene?.[1]}</span>
        </p>
      </div>
      <FilmControls
        s={s}
        playing={film.playing}
        onToggle={film.toggle}
        onRestart={film.restart}
        onSeek={film.seek}
      />
      <p className="disclaim">
        Illustrative run of the lb-demo-shop repo · scripted data, real dashboard components
      </p>
    </div>
  );
}
