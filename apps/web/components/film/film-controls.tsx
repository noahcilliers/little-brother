import { lastBefore, mmss } from "./film-clock";
import { clockAt, PLAYBACK_DURATION, playbackAt } from "./film-tempo";
import { CHAPTERS } from "./film-timeline";

type Props = {
  /** Playback seconds, not film-clock seconds: the scrubber and clock show real time. */
  p: number;
  playing: boolean;
  onToggle: () => void;
  onRestart: () => void;
  onSeek: (p: number) => void;
};

/** Play/pause, restart, a scrubber with chapter jumps, and the clock. */
export function FilmControls({ p, playing, onToggle, onRestart, onSeek }: Props) {
  const chapter = lastBefore(CHAPTERS, clockAt(p));
  return (
    <div className="fc-controls">
      <button type="button" className="fc-ctl" onClick={onToggle}>
        {playing ? "Pause" : "Play"}
      </button>
      <button type="button" className="fc-ctl" onClick={onRestart}>
        Restart
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
    </div>
  );
}
