import type { CSSProperties } from "react";
import { DecisionSide } from "@/components/board/decision-side";
import { InlineIcon } from "@/components/board/icons";
import { conflictTokens } from "@/lib/diff-tokens";
import { agentColor } from "@/lib/format";
import { FULL_BOARD } from "./film-board";
import { clamp01, easeInOut } from "./film-clock";
import { DECISION } from "./film-decision-data";
import { POPUP } from "./film-story";

const TOKENS = conflictTokens(DECISION.sides.map((d) => d.preview));
const COLOR = new Map(FULL_BOARD.agents.map((a) => [a.id, agentColor(a.color)]));

function Pointer({ s }: { s: number }) {
  if (s < POPUP.cursorIn) return null;
  const p = easeInOut(clamp01((s - POPUP.cursorIn) / (POPUP.cursorAt - POPUP.cursorIn)));
  const press = s >= POPUP.click - 0.15 && s < POPUP.click + 0.15 ? 0.82 : 1;
  const style: CSSProperties = {
    transform: `translate(${380 - 330 * p}px, ${150 - 132 * p}px) scale(${press})`,
  };
  return (
    <span className="film-pointer" style={style}>
      <svg viewBox="0 0 18 22" aria-hidden="true">
        <path d="M1 1 L1 17 L5.5 13 L8.5 20 L11 19 L8 12 L14 12 Z" />
      </svg>
    </span>
  );
}

/** The dashboard's decision popup, played: both sides as diffs, the owner keeps one, the update goes out. */
export function FilmDecision({ s }: { s: number }) {
  if (s < POPUP.open || s > POPUP.close + 0.4) return null;
  const enter = easeInOut(clamp01((s - POPUP.open) / 0.45));
  const leave = easeInOut(clamp01((s - POPUP.close) / 0.35));
  const shown = enter * (1 - leave);
  const decided = s >= POPUP.click + 0.1;
  const pressed = s >= POPUP.click - 0.15 && s < POPUP.click + 0.15;
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
            Kept {a?.keep} · delivered to {b?.handle}'s session
          </p>
        ) : (
          <div className="choices film-choices">
            <button type="button" tabIndex={-1} className={pressed ? "primary pressed" : "primary"}>
              <span className="kbd">1</span> Keep {a?.keep}
            </button>
            <button type="button" tabIndex={-1}>
              <span className="kbd">2</span> Keep {b?.keep}
            </button>
            <button type="button" tabIndex={-1}>
              Dismiss as compatible
            </button>
            <span className="hint">
              <span className="kbd">Esc</span> decide later
            </span>
            <Pointer s={s} />
          </div>
        )}
      </div>
    </div>
  );
}
