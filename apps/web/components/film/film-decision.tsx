import { DecisionSide } from "@/components/board/decision-side";
import { InlineIcon } from "@/components/board/icons";
import { conflictTokens } from "@/lib/diff-tokens";
import { agentColor } from "@/lib/format";
import { FULL_BOARD } from "./film-board";
import { window01 } from "./film-clock";
import { DECISION } from "./film-decision-data";
import { BEAT } from "./film-timeline";

const TOKENS = conflictTokens(DECISION.sides.map((d) => d.preview));
const COLOR = new Map(FULL_BOARD.agents.map((a) => [a.id, agentColor(a.color)]));

/** The dashboard's decision popup, played: both sides as diffs; the owner decides (here, from his phone). */
export function FilmDecision({ s }: { s: number }) {
  const shown = window01(s, BEAT.popup, BEAT.popupClose, 0.35);
  if (shown <= 0) return null;
  const decided = s >= BEAT.phoneTap + 0.15;
  const [a, b] = DECISION.sides;
  return (
    <div className="film-overlay" style={{ opacity: shown }}>
      <div
        className="modal card film-modal"
        style={{ transform: `translateY(${(1 - shown) * 18}px) scale(${0.97 + 0.03 * shown})` }}
      >
        <header className="mhead">
          <InlineIcon name="bolt" color="var(--hot)" size={18} />
          <h2>{DECISION.topic} needs a decision</h2>
          <button type="button" className="close" tabIndex={-1}>
            ✕
          </button>
        </header>
        <div className="mmeta">
          owner: {DECISION.owner} · detected {Math.round(DECISION.detectedAfterMs / 1000)} s after the change
        </div>
        <p className="rationale">{DECISION.rationale}</p>
        <div className="dcols">
          {DECISION.sides.map((side, i) => (
            <DecisionSide
              key={side.nodeId}
              side={side}
              color={COLOR.get(side.agentId) ?? "var(--ink)"}
              keyHint={String(i + 1)}
              tokens={TOKENS[i] ?? []}
            />
          ))}
        </div>
        {decided ? (
          <p className="delivery done">
            Noah kept {a?.keep} · delivered to {b?.handle}'s session
          </p>
        ) : (
          <div className="choices">
            <button type="button" tabIndex={-1} className="primary">
              <span className="kbd">1</span> Keep {a?.keep}
            </button>
            <button type="button" tabIndex={-1}>
              <span className="kbd">2</span> Keep {b?.keep}
            </button>
            <button type="button" tabIndex={-1}>
              Dismiss as compatible
            </button>
            <span className="hint">waiting on owner: noah</span>
          </div>
        )}
      </div>
    </div>
  );
}
