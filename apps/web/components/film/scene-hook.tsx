import { CATCH_ICON, InlineIcon } from "@/components/board/icons";
import { prog } from "./film-clock";
import { rise } from "./film-fx";
import { HookStat, type Stat } from "./hook-stat";

// Scene 1: three quick sourced numbers on the scale of the problem, then the problem in one line as five agents
// drift apart, then what that costs.

// biome-ignore format: one stat per row
const STATS: Stat[] = [
  { from: 0.1, to: 1.7, value: 42, unit: "%", text: "of committed code is written by AI", src: "Sonar State of Code 2026" },
  { from: 1.9, to: 3.5, lead: "Agents burn", pre: "~", value: 5, unit: "×", text: "the tokens a human does", src: "OpenRouter / Futurum 2026 · a16z × OpenRouter" },
  { from: 3.7, to: 5.3, lead: "Agent teams succeed", pre: "~", value: 30, unit: "% less", text: "often than one agent alone", src: "CooperBench, Jan 2026" },
];
/** When the problem statement starts, after the stats. */
const LINE = 5.4;
const AGENTS = ["Ash", "Noah", "Joshua", "Maya", "Leo"];
const PROBLEMS = [
  ["redo work", CATCH_ICON.duplicate],
  ["repeat failures", CATCH_ICON.stale],
  ["collide", CATCH_ICON.conflict],
] as const;
const THEN = LINE + 2;

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
  const split = prog(s, LINE + 1, 0.7);
  return (
    <div className="fh">
      <div className="fh-grid" aria-hidden="true" />
      {STATS.map((st) => (
        <HookStat key={st.src} s={s} st={st} />
      ))}
      <div className="fh-stack">
        {s >= LINE - 0.1 && s < THEN + 0.4 ? (
          <Words
            text="Your team's agents can't see each other."
            s={s}
            from={LINE + 0.1}
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
      <div
        className="fh-agents"
        style={{ gap: `${14 + split * 46}px`, opacity: 1 - prog(s, THEN - 0.2, 0.4) }}
      >
        {AGENTS.map((name, i) => (
          <span
            key={name}
            className={split > 0.5 ? "fh-agent alone" : "fh-agent"}
            style={{ ...rise(prog(s, LINE + 0.3 + i * 0.07, 0.35)), filter: `blur(${split * 1.2}px)` }}
          >
            <i />
            {name}'s agent
          </span>
        ))}
      </div>
    </div>
  );
}
