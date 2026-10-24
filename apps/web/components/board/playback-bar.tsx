import { clock, elapsed } from "@/lib/format";
import type { TimeAxis } from "@/lib/time-axis";
import type { Mode } from "@/lib/use-playback";
import { LegendToggle } from "./legend";

type Props = {
  axis: TimeAxis | undefined;
  mode: Mode;
  t: number;
  c: number;
  onLive: () => void;
  onPause: () => void;
  onReplay: () => void;
  onScrub: (c: number) => void;
  /** Carry on a paused replay; without it, Play restarts from the start. */
  onResume?: () => void;
};

/**
 * Live needs no transport: a live mark and Replay. Replaying or paused shows the scrubber with Pause or Play and
 * the way back to Live. How-to-read sits behind "?" either way.
 */
export function PlaybackBar({ axis, mode, t, c, onLive, onPause, onReplay, onScrub, onResume }: Props) {
  const span = axis?.span ?? 1;
  const at = axis ? elapsed(t, axis.start) : "0:00";
  if (mode === "live") {
    return (
      <div className="playback">
        <span className="live-mark" title={clock(t)}>
          <i aria-hidden="true" />
          live
        </span>
        <button type="button" className="ctl" onClick={onReplay} disabled={!axis}>
          Replay
        </button>
        <LegendToggle />
      </div>
    );
  }
  return (
    <div className="playback replaying">
      {mode === "paused" ? (
        <button type="button" className="ctl" onClick={onResume ?? onReplay}>
          Play
        </button>
      ) : (
        <button type="button" className="ctl" onClick={onPause}>
          Pause
        </button>
      )}
      <button type="button" className="ctl" onClick={onLive}>
        Live
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
        {at} · {mode === "replay" ? "replay" : "paused"}
      </span>
      <LegendToggle />
    </div>
  );
}
