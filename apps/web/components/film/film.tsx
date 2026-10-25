"use client";

import "./film.css";
import "./film-frames.css";
import "./film-popups.css";
import "./film-terminal.css";
import "./film-phone.css";
import "./film-phone-cards.css";
import "./film-hook.css";
import "./film-loop.css";
import "./film-why.css";
import "./film-measure.css";
import "./film-close.css";
import "./film-callouts.css";
import "./film-learn.css";
import "./film-runs.css";
import "./film-runs-side.css";
import "./film-runs-why.css";
import { type ReactNode, useRef } from "react";
import { lastBefore } from "./film-clock";
import { FilmControls } from "./film-controls";
import { layerStyle } from "./film-fx";
import { clockAt } from "./film-tempo";
import { CHAPTERS, SCENES, type SceneId, STORY_SHIFT, SUBS } from "./film-timeline";
import { SceneClose } from "./scene-close";
import { SceneHook } from "./scene-hook";
import { SceneHow } from "./scene-how";
import { SceneImpact } from "./scene-impact";
import { SceneLearn } from "./scene-learn";
import { SceneMeasure } from "./scene-measure";
import { SceneRuns } from "./scene-runs";
import { SceneStory, W } from "./scene-story";
import { SceneWhy } from "./scene-why";
import { useFilm } from "./use-film";
import { useFullscreen } from "./use-fullscreen";
import { useWidth } from "./use-stage";

/** The landing page's launch video: one clock, nine scenes, the real dashboard in the middle of it. */
export function Film() {
  const wrap = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const full = useFullscreen(shell);
  const width = useWidth(wrap, W);
  const film = useFilm(wrap);
  const s = clockAt(film.t);
  const still = film.reduced;
  const sub = lastBefore(SUBS, s);
  const chapter = lastBefore(CHAPTERS, s);
  /** Each motion scene runs on its own clock, 0 at its start. */
  const local = (id: SceneId) => s - SCENES[id][0];
  const layer = (id: SceneId, child: ReactNode) => {
    const style = layerStyle(id, s, still);
    return style ? (
      <div key={id} className={`film-layer l-${id}`} style={style}>
        {child}
      </div>
    ) : null;
  };
  return (
    <div className="showcase" id="demo" ref={shell}>
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
            {layer("story", <SceneStory s={s - STORY_SHIFT} still={still} />)}
            {layer("why", <SceneWhy s={local("why")} />)}
            {layer("how", <SceneHow s={local("how")} />)}
            {layer("learn", <SceneLearn s={local("learn")} />)}
            {layer("runs", <SceneRuns s={local("runs")} still={still} />)}
            {layer("measure", <SceneMeasure s={local("measure")} />)}
            {layer("impact", <SceneImpact s={local("impact")} />)}
            {layer("close", <SceneClose s={local("close")} />)}
          </div>
        </div>
        <p className="film-sub" aria-live="polite">
          <b>{chapter?.[1]}</b>
          <span key={sub?.[0]}>{sub?.[1]}</span>
        </p>
      </div>
      <FilmControls
        p={film.t}
        playing={film.playing}
        fast={film.fast}
        onToggle={film.toggle}
        onSpeed={film.toggleSpeed}
        onRestart={film.restart}
        onSeek={film.seek}
        fullscreen={full.supported ? { on: full.on, toggle: full.toggle } : undefined}
      />
    </div>
  );
}
