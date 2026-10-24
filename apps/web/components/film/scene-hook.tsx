import { CATCH_ICON, InlineIcon } from "@/components/board/icons";
import { prog } from "./film-clock";
import { rise } from "./film-fx";
import { HookStat, type Stat } from "./hook-stat";

// biome-ignore format: one stat per row
const STATS: Stat[] = [
  { from: 0.15, to: 2.4, value: 42, unit: "%", text: "of committed code is now written by AI", src: "Sonar State of Code 2026" },
  { from: 2.6, to: 5, lead: "Agents burn", pre: "~", value: 5, unit: "×", text: "the tokens a human does, 70–85% of it re-reading context already seen", src: "OpenRouter / Futurum 2026 · a16z × OpenRouter" },
  { from: 5.2, to: 7.5, lead: "Teams of coding agents succeed", pre: "~", value: 30, unit: "% less", text: "often than one agent working alone", note: "42% of their failures: misjudging what the partner is doing", src: "CooperBench, Jan 2026" },
];
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

/** Scene 1: the scale of the problem in three sourced numbers, then why it happens. */
export function SceneHook({ s }: { s: number }) {
  return (
    <div className="fh">
      <div className="fh-grid" aria-hidden="true" />
      {STATS.map((st) => (
        <HookStat key={st.src} s={s} st={st} />
      ))}
      <div className="fh-stack">
        {s >= 7.6 && s < 9.7 ? (
          <Words text="They can't see each other." s={s} from={7.65} to={9.3} accent={["can't", "see"]} />
        ) : null}
        {s >= 9.3 ? (
          <span className="fh-line fh-three">
            <span className="fh-mask">
              <span className="fh-word" style={rise(prog(s, 9.35, 0.4))}>
                So they
              </span>
            </span>
            {PROBLEMS.map(([label, icon], i) => (
              <span key={label} className="fh-mask">
                <span
                  className={i === 2 ? "fh-chip accent" : "fh-chip"}
                  style={rise(prog(s, 9.55 + i * 0.28, 0.45))}
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
    </div>
  );
}
