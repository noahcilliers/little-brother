"use client";

import "./film.css";
import { useRef } from "react";
import { stageTransform } from "./film-camera";
import { lastBefore } from "./film-clock";
import { FilmControls } from "./film-controls";
import { FilmStage } from "./film-stage";
import { CHAPTERS, SCENES } from "./film-story";
import { useFilm } from "./use-film";
import { useStage, useWidth } from "./use-stage";

/** The landing page's product video: a scripted run of the real dashboard on lb-demo-shop, three catches. */
export function Film() {
  const wrap = useRef<HTMLDivElement>(null);
  const app = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const { geo, list } = useStage(app);
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
        <div className="film-view" ref={wrap} style={{ aspectRatio: `${geo.w} / ${geo.h}` }}>
          <div className="film-stage" aria-hidden="true" inert>
            <FilmStage s={s} appRef={app} transform={stageTransform(list, geo, s, width, film.reduced)} />
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
