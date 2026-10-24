import { CATCH_ICON, InlineIcon } from "@/components/board/icons";
import { prog } from "./film-clock";
import { rise } from "./film-fx";

const AGENTS = ["Ash", "Noah", "Joshua", "Maya", "Leo"];
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
        <span key={`${w}${i}`} className="fh-mask">
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

/** Scene 1: the problem in three beats of kinetic type. */
export function SceneHook({ s }: { s: number }) {
  const split = prog(s, 1.9, 0.6);
  return (
    <div className="fh">
      <div className="fh-grid" aria-hidden="true" />
      <div className="fh-stack">
        {s < 2.2 ? (
          <Words text="Your team runs five Claude Code agents." s={s} from={0.15} to={1.75} />
        ) : null}
        {s >= 1.8 && s < 3.6 ? (
          <Words text="They can't see each other." s={s} from={1.85} to={3.3} accent={["can't", "see"]} />
        ) : null}
        {s >= 3.3 ? (
          <span className="fh-line fh-three">
            <span className="fh-mask">
              <span className="fh-word" style={rise(prog(s, 3.35, 0.4))}>
                So they
              </span>
            </span>
            {PROBLEMS.map(([label, icon], i) => (
              <span key={label} className="fh-mask">
                <span
                  className={i === 2 ? "fh-chip accent" : "fh-chip"}
                  style={rise(prog(s, 3.6 + i * 0.32, 0.45))}
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
      <div className="fh-agents" style={{ gap: `${14 + split * 46}px`, opacity: 1 - prog(s, 3.3, 0.4) }}>
        {AGENTS.map((name, i) => (
          <span
            key={name}
            className={split > 0.5 ? "fh-agent alone" : "fh-agent"}
            style={{ ...rise(prog(s, 0.6 + i * 0.09, 0.4)), filter: `blur(${split * 1.2}px)` }}
          >
            <i />
            {name}'s agent
          </span>
        ))}
      </div>
    </div>
  );
}
