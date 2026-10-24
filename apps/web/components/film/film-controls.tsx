import { DURATION, lastBefore, mmss } from "./film-clock";
import { CHAPTERS } from "./film-story";

type Props = {
  s: number;
  playing: boolean;
  onToggle: () => void;
  onRestart: () => void;
  onSeek: (s: number) => void;
};

/** Play/pause, restart, a scrubber with chapter jumps, and the clock. */
export function FilmControls({ s, playing, onToggle, onRestart, onSeek }: Props) {
  const chapter = lastBefore(CHAPTERS, s);
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
          max={DURATION}
          step={0.05}
          value={s}
          aria-label="Seek"
          onChange={(e) => onSeek(Number(e.target.value))}
        />
        <div className="chapters">
          {CHAPTERS.map(([start, name]) => (
            <button
              key={name}
              type="button"
              aria-current={chapter?.[0] === start}
              onClick={() => onSeek(start)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <span className="fc-clock">
        {mmss(s)} / {mmss(DURATION)}
      </span>
    </div>
  );
}
