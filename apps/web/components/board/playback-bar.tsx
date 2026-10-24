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

export function PlaybackBar({ axis, mode, t, c, onLive, onPause, onReplay, onScrub }: Props) {
  return (
    <footer className="card">
      <div className="controls">
        {mode === "live" ? (
          <button type="button" className="ctl" onClick={onPause}>
            Pause
          </button>
        ) : (
          <button type="button" className="ctl on" onClick={onLive}>
            Live
          </button>
        )}
        <button type="button" className="ctl" onClick={onReplay} disabled={!axis}>
          Replay
        </button>
        <input
          type="range"
          className="scrub"
          min={0}
          max={axis?.span ?? 1}
          step={50}
          value={Math.min(c, axis?.span ?? 1)}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-label="Time"
        />
        <span className="clock" title={clock(t)}>
          {axis ? elapsed(Math.min(t, axis.fromC(axis.span)), axis.start) : "0:00"}
          {mode === "live" ? " · live" : mode === "replay" ? " · replay" : " · paused"}
        </span>
      </div>
      <Legend />
    </footer>
  );
}
