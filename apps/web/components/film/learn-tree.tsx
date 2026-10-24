import { prog } from "./film-clock";
import { countUp } from "./film-fx";

// A reasoning trajectory tree: Noah's failed branch is distilled into a lesson and pruned; a later agent heading
// the same way is routed around it (the stale catch). The counter is the real replay number.

type Pill = [cx: number, cy: number, text: string];
const ROOT: Pill = [130, 470, "goal: call the API"];
// biome-ignore format: tabular scenario data
const FAIL: Pill[] = [[340, 330, "plan: CORS middleware"], [545, 300, "edit cors({ origin: * })"], [750, 270, "npm test ✕"]];
// biome-ignore format: tabular scenario data
const WORK: Pill[] = [[340, 610, "plan: Vite proxy"], [545, 640, "edit server.proxy"], [750, 670, "npm test ✓"]];
const T0 = 48.8;

function PillNode({ p, cls, shown }: { p: Pill; cls: string; shown: number }) {
  const [cx, cy, text] = p;
  return (
    <g style={{ opacity: shown }}>
      <rect x={cx - 92} y={cy - 20} width={184} height={40} rx={20} className={`lt-pill ${cls}`} />
      <text x={cx} y={cy + 5} textAnchor="middle" className="lt-text">
        {text}
      </text>
    </g>
  );
}

const chain = (pills: Pill[]) => [ROOT, ...pills].map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

export function LearnTree({ s }: { s: number }) {
  const failDraw = prog(s, T0 + 0.2, 1);
  const failed = s >= T0 + 1.2;
  const pruned = prog(s, T0 + 1.6, 0.5);
  const workDraw = prog(s, T0 + 1.3, 0.9);
  const later = prog(s, T0 + 2.4, 1.4);
  const counter = prog(s, T0 + 3.7, 0.8);
  return (
    <svg viewBox="0 0 880 900" className="lt" aria-hidden="true">
      <path
        d={chain(FAIL)}
        pathLength={1}
        className={failed ? "lt-edge fail" : "lt-edge"}
        style={{ strokeDashoffset: 1 - failDraw, opacity: 1 - pruned * 0.65 }}
      />
      <path
        d={chain(WORK)}
        pathLength={1}
        className="lt-edge ok"
        style={{ strokeDashoffset: 1 - workDraw }}
      />
      <path
        d="M130 470 C220 440 250 400 290 380 C330 420 300 560 340 610 L545 640 L750 670"
        pathLength={1}
        className="lt-edge later"
        style={{ strokeDashoffset: 1 - later, opacity: later > 0 ? 1 : 0 }}
      />
      {pruned > 0 ? (
        <path d="M220 360 l40 40 M260 360 l-40 40" className="lt-cut" style={{ opacity: pruned }} />
      ) : null}
      <PillNode p={ROOT} cls="root" shown={prog(s, T0, 0.3)} />
      {FAIL.map((p, i) => (
        <PillNode
          key={p[2]}
          p={p}
          cls={i === 2 && failed ? "fail" : pruned > 0 ? "pruned" : ""}
          shown={Math.min(prog(s, T0 + 0.25 + i * 0.3, 0.3), 1 - pruned * 0.6)}
        />
      ))}
      {WORK.map((p, i) => (
        <PillNode key={p[2]} p={p} cls={i === 2 ? "ok" : ""} shown={prog(s, T0 + 1.4 + i * 0.25, 0.3)} />
      ))}
      <g style={{ opacity: pruned }}>
        <rect x={400} y={176} width={474} height={44} rx={10} className="lt-lesson" />
        <text x={416} y={204} className="lt-text left">
          ⬡ lesson: wildcard CORS + credentials fails → proxy
        </text>
      </g>
      <text x={250} y={540} className="lt-note" style={{ opacity: prog(s, T0 + 3, 0.4) }}>
        later agent: steered around (stale catch)
      </text>
      <g style={{ opacity: counter }}>
        <text x={40} y={800} className="lt-big">
          {countUp(2, counter)}
        </text>
        <text x={120} y={776} className="lt-text left">
          failed paths pruned before anyone retried them
        </text>
        <text x={120} y={804} className="lt-src">
          stale paths avoided · 6-agent replay · part of the ≈ 8.5k tokens saved (estimate)
        </text>
      </g>
    </svg>
  );
}
