import { useRef } from "react";
import { THOUGHTS } from "./film-log";
import { lastBefore } from "./film-math";
import { FOCUS, PANE, type PaneKey } from "./film-story";

/** Lines in the focused session; the newest one slides in while the same session keeps growing. */
function useGrewLast(key: PaneKey, count: number): boolean {
  const prev = useRef({ key, count, grew: false });
  if (prev.current.key !== key || prev.current.count !== count) {
    prev.current = { key, count, grew: prev.current.key === key && count > prev.current.count };
  }
  return prev.current.grew;
}

function Resolve({ t }: { t: number }) {
  const approved = t >= 30.2;
  const pressed = t >= 29.9 && t < 30.3;
  return (
    <div className="resolve">
      <div className={`opt ${approved ? "win" : ""}`}>
        <b>jwt-bearer</b>
        <span>Noah's agent · src/auth/issue-token.ts</span>
      </div>
      <div className={`opt ${approved ? "lose" : ""}`}>
        <b>cookie-session</b>
        <span>Joshua's agent · src/checkout/session.ts</span>
      </div>
      <div className="rv-note">
        owner noah · detected 41 s after the split ·{" "}
        {approved ? "pushed to joshua" : "edits on auth.mechanism paused"}
      </div>
      <div className="rv-btns">
        <span className={`a ${pressed ? "pressed" : ""}`}>{approved ? "Approved ✓" : "Approve jwt-bearer"}</span>
        <span className="b">Keep cookie-session</span>
      </div>
    </div>
  );
}

/** Top-right pane: whichever session the story is following, or the dashboard's resolve card. */
export function FilmThink({ t }: { t: number }) {
  const pane = lastBefore(FOCUS, t)?.[1] ?? "joshua";
  const lines = THOUGHTS.filter(([p, at]) => p === pane && at <= t);
  const grew = useGrewLast(pane, lines.length);
  const [title, sub] = PANE[pane];
  return (
    <div className="pane p-think">
      <div className="ph">
        <span>{title}</span>
        <small>{sub}</small>
      </div>
      {pane === "resolve" ? (
        <Resolve t={t} />
      ) : (
        <div className="lines">
          {lines.map(([, at, kind, text], i) => {
            const enter = grew && i === lines.length - 1 ? " enter" : "";
            if (kind !== "lb")
              return (
                <div key={`${pane}${at}`} className={`ln ${kind}${enter}`}>
                  {text}
                </div>
              );
            const [head, body] = text.split("|");
            return (
              <div key={`${pane}${at}`} className={`ln lb${enter}`}>
                <b>little-brother · {head}</b>
                {body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
