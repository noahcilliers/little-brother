import { lastBefore, mmss } from "./film-clock";
import { clockAt, PLAYBACK_DURATION, playbackAt } from "./film-tempo";
import { CHAPTERS } from "./film-timeline";

type Props = {
  /** Playback seconds, not film-clock seconds: the scrubber and clock show real time. */
  p: number;
  playing: boolean;
  fast: boolean;
  onToggle: () => void;
  onSpeed: () => void;
  onRestart: () => void;
  onSeek: (p: number) => void;
  /** Absent where the browser can't fullscreen an element. */
  fullscreen?: { on: boolean; toggle: () => void };
};

/** Play/pause, restart, 1×/2× speed, a scrubber with chapter jumps, the clock, and fullscreen. */
export function FilmControls({ p, playing, fast, onToggle, onSpeed, onRestart, onSeek, fullscreen }: Props) {
  const chapter = lastBefore(CHAPTERS, clockAt(p));
  return (
    <div className="fc-controls">
      <button type="button" className="fc-ctl" onClick={onToggle}>
        {playing ? "Pause" : "Play"}
      </button>
      <button type="button" className="fc-ctl" onClick={onRestart}>
        Restart
      </button>
      <button
        type="button"
        className="fc-ctl"
        aria-pressed={fast}
        aria-label="Double speed"
        onClick={onSpeed}
      >
        {fast ? "2×" : "1×"}
      </button>
      <div className="fc-scrub">
        <input
          type="range"
          min={0}
          max={PLAYBACK_DURATION}
          step={0.05}
          value={p}
          aria-label="Seek"
          onChange={(e) => onSeek(Number(e.target.value))}
        />
        <div className="chapters">
          {CHAPTERS.map(([start, name]) => (
            <button
              key={name}
              type="button"
              aria-current={chapter?.[0] === start}
              onClick={() => onSeek(playbackAt(start))}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <span className="fc-clock">
        {mmss(p)} / {mmss(PLAYBACK_DURATION)}
      </span>
      {fullscreen ? (
        <button
          type="button"
          className="fc-ctl"
          aria-pressed={fullscreen.on}
          title={fullscreen.on ? "Exit fullscreen (f)" : "Fullscreen (f)"}
          onClick={fullscreen.toggle}
        >
          {fullscreen.on ? "Exit full screen" : "Full screen"}
        </button>
      ) : null}
    </div>
  );
}
