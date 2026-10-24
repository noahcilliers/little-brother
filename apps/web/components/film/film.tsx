"use client";

import "./film.css";
import "./film-story.css";
import "./film-motion.css";
import "./film-devices.css";
import "./film-metrics.css";
import { type ReactNode, useRef } from "react";
import { lastBefore } from "./film-clock";
import { FilmControls } from "./film-controls";
import { layerStyle } from "./film-fx";
import { CHAPTERS, type SceneId, SUBS } from "./film-timeline";
import { SceneClose } from "./scene-close";
import { SceneHook } from "./scene-hook";
import { SceneHow } from "./scene-how";
import { SceneLearn } from "./scene-learn";
import { SceneMetrics } from "./scene-metrics";
import { SceneStory, W } from "./scene-story";
import { useFilm } from "./use-film";
import { useWidth } from "./use-stage";

/** The landing page's launch video: one clock, seven scenes, the real dashboard in the middle of it. */
export function Film() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, W);
  const film = useFilm(wrap);
  const s = film.t;
  const still = film.reduced;
  const sub = lastBefore(SUBS, s);
  const chapter = lastBefore(CHAPTERS, s);
  const layer = (id: SceneId, child: ReactNode) => {
    const style = layerStyle(id, s, still);
    return style ? (
      <div key={id} className={`film-layer l-${id}`} style={style}>
        {child}
      </div>
    ) : null;
  };
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
          <span className="live">live · 3 people</span>
        </div>
        <div className="film-view" ref={wrap}>
          <div className="film-stage" aria-hidden="true" inert style={{ transform: `scale(${width / W})` }}>
            {layer("hook", <SceneHook s={s} />)}
            {layer("story", <SceneStory s={s} still={still} />)}
            {layer("how", <SceneHow s={s} />)}
            {layer("learn", <SceneLearn s={s} />)}
            {layer("metrics", <SceneMetrics s={s} still={still} />)}
            {layer("close", <SceneClose s={s} />)}
          </div>
        </div>
        <p className="film-sub" aria-live="polite">
          <b>{chapter?.[1]}</b>
          <span key={sub?.[0]}>{sub?.[1]}</span>
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
        Illustrative run of lb-demo-shop on the real dashboard components · metrics from our replay and test
        suites
      </p>
    </div>
  );
}
