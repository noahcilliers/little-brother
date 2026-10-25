import { CATCH_ICON, InlineIcon } from "@/components/board/icons";
import { prog } from "./film-clock";
import { rise } from "./film-fx";
import { type Stat, StatTile } from "./hook-stat";

// Scene 1: the problem in one line with three sourced numbers under it, then what it costs.

// biome-ignore format: one stat per row
const STATS: Stat[] = [
  { value: 42, unit: "%", text: "of committed code is written by AI", src: "Sonar State of Code 2026" },
  { lead: "Agents burn", pre: "~", value: 5, unit: "×", text: "the tokens a human does", src: "OpenRouter / Futurum 2026 · a16z × OpenRouter" },
  { lead: "Agent teams succeed", pre: "~", value: 30, unit: "%", text: "less often than one agent alone", src: "CooperBench, Jan 2026" },
];
/** When each stat rises in under the statement. */
const STAT_AT = [1, 1.6, 2.2];
/** When the statement and its stats leave and the cost line takes over. */
const THEN = 6.8;
/** Half the stats row plus the gap above it, in stage pixels: the cost line slides this far to sit centered. */
const RECENTER = 150;
const PROBLEMS = [
  ["redo work", CATCH_ICON.duplicate],
  ["repeat failures", CATCH_ICON.stale],
  ["collide", CATCH_ICON.conflict],
] as const;

/** One line of kinetic type: each word rises out of its own mask, staggered, and the line leaves upward. */
function Words({
  text,
  s,
  from,
  to,
  accent = [],
}: {
  text: string;
  s: number;
  from: number;
  to: number;
  accent?: string[];
}) {
  const out = prog(s, to, 0.35);
  return (
    <span className="fh-line" style={{ transform: `translateY(${-out * 40}px)`, opacity: 1 - out }}>
      {text.split(" ").map((w, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: words of a fixed line never reorder
        <span key={i} className="fh-mask">
          <span
            className={accent.includes(w) ? "fh-word accent" : "fh-word"}
            style={rise(prog(s, from + i * 0.07, 0.45))}
          >
            {w}
          </span>
        </span>
      ))}
    </span>
  );
}

export function SceneHook({ s }: { s: number }) {
  const out = prog(s, THEN - 0.2, 0.4);
  return (
    <div className="fh">
      <div className="fh-grid" aria-hidden="true" />
      <div className="fh-stack" style={{ transform: `translateY(${out * RECENTER}px)` }}>
        {s < THEN + 0.4 ? (
          <Words
            text="Your team's agents can't see each other."
            s={s}
            from={0.1}
            to={THEN - 0.2}
            accent={["can't", "see"]}
          />
        ) : null}
        {s >= THEN - 0.1 ? (
          <span className="fh-line fh-three">
            <span className="fh-mask">
              <span className="fh-word" style={rise(prog(s, THEN, 0.4))}>
                So they
              </span>
            </span>
            {PROBLEMS.map(([label, icon], i) => (
              <span key={label} className="fh-mask">
                <span
                  className={i === 2 ? "fh-chip accent" : "fh-chip"}
                  style={rise(prog(s, THEN + 0.25 + i * 0.3, 0.45))}
                >
                  <InlineIcon name={icon} color="currentColor" size={34} />
                  {label}
                  {i < 2 ? "," : "."}
                </span>
              </span>
            ))}
          </span>
        ) : null}
      </div>
      {/* Stays in the layout once faded, so the cost line doesn't jump when the stats leave. */}
      <div className="hs-row" style={{ opacity: 1 - out, transform: `translateY(${-out * 30}px)` }}>
        {STATS.map((st, i) => (
          <StatTile key={st.src} s={s} st={st} at={STAT_AT[i] ?? 0} />
        ))}
      </div>
    </div>
  );
}
