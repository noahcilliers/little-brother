import { clock, elapsed } from "@/lib/format";
import type { TimeAxis } from "@/lib/time-axis";
import type { Mode } from "@/lib/use-playback";
import { Legend } from "./legend";

type Props = {
  axis: TimeAxis | undefined;
  mode: Mode;
  t: number;
  c: number;
  onLive: () => void;
  onPause: () => void;
  onReplay: () => void;
  onScrub: (c: number) => void;
};

/** Live follows the clock; Pause holds; Replay plays the run from the start; the scrubber moves through it. */
export function PlaybackBar({ axis, mode, t, c, onLive, onPause, onReplay, onScrub }: Props) {
  const span = axis?.span ?? 1;
  return (
    <div className="card">
      <div className="controls">
        {mode === "paused" ? (
          <button type="button" className="ctl" onClick={onLive}>
            Live
          </button>
        ) : (
          <button type="button" className="ctl" onClick={onPause}>
            Pause
          </button>
        )}
        <button type="button" className="ctl" onClick={onReplay} disabled={!axis}>
          Replay
        </button>
        <input
          type="range"
          className="scrub"
          min={0}
          max={span}
          step={50}
          value={Math.min(c, span)}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-label="Time"
        />
        <span className="clock" title={clock(t)}>
          {axis ? elapsed(t, axis.start) : "0:00"}
          {mode === "live" ? " · live" : mode === "replay" ? " · replay" : " · paused"}
        </span>
      </div>
      <Legend />
    </div>
  );
}
