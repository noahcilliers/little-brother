"use client";

import "./film.css";
import { type RefObject, useEffect, useRef, useState } from "react";
import { FilmGraph } from "./film-graph";
import { DURATION } from "./film-graph-data";
import { cursorAt, lastBefore, mmss, stageTransform } from "./film-math";
import { CATCHES, CHAPTERS, SCENES } from "./film-story";
import { FilmTable } from "./film-table";
import { FilmThink } from "./film-think";
import { useFilm } from "./use-film";

/** Width of the stage viewport, so the 1200px stage can be scaled and zoomed into it. */
function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(1200);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** The landing page's product preview: a scripted 44 s run of the demo repo with three catches. */
export function Film() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const film = useFilm(wrap);
  const { t } = film;
  const scene = lastBefore(SCENES, t) ?? SCENES[0];
  const focus = new Set(scene?.[3] ?? []);
  const caught = lastBefore(CATCHES, t);
  const cursor = cursorAt(t);
  const chapter = lastBefore(CHAPTERS, t);
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
        <div className="stage-wrap" ref={wrap}>
          <div className="stage" style={{ transform: stageTransform(t, width, film.reduced) }}>
            <FilmGraph t={t} focus={focus} />
            <FilmThink t={t} />
            <FilmTable t={t} />
            <div className="pane p-cap">
              <span className="cap-tag">{scene?.[1]}</span>
              <p className="cap-text">{scene?.[2]}</p>
              <div className="counters">
                <div>
                  <b>{caught?.[1] ?? "0"}</b>catches before push
                </div>
                <div>
                  <b>{caught?.[2] ?? "0"}</b>est. tokens saved
                </div>
              </div>
            </div>
            <div className="cursor" style={{ opacity: cursor ? 1 : 0, transform: cursor?.transform }}>
              <svg viewBox="0 0 18 22" aria-hidden="true">
                <path d="M1 1 L1 17 L5.5 13 L8.5 20 L11 19 L8 12 L14 12 Z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="cap-mobile">
          <b>{scene?.[1]}</b>
          {scene?.[2]}
        </div>
      </div>
      <div className="fc-controls">
        <button type="button" className="fc-ctl" onClick={film.toggle}>
          {film.playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="fc-ctl" onClick={film.restart}>
          Restart
        </button>
        <div className="fc-scrub">
          <input
            type="range"
            min={0}
            max={DURATION}
            step={0.05}
            value={t}
            aria-label="Seek"
            onChange={(e) => film.seek(Number(e.target.value))}
          />
          <div className="chapters">
            {CHAPTERS.map(([at, name]) => (
              <button
                key={name}
                type="button"
                aria-current={chapter?.[0] === at}
                onClick={() => film.seek(at)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <span className="fc-clock">
          {mmss(t)} / {mmss(DURATION)}
        </span>
      </div>
      <p className="disclaim">
        Illustrative run of the Cal Hacks demo repo · numbers are from the scripted scenario
      </p>
    </div>
  );
}
