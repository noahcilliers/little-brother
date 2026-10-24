import { prog } from "./film-clock";
import { rise } from "./film-fx";

const LINES = [
  "Every duplicate stopped is tokens not burned.",
  "Every stale path pruned is a failure not repeated.",
];

/** The impact beat before the close: the point, restated. Local clock. */
export function SceneImpact({ s }: { s: number }) {
  return (
    <div className="im">
      {LINES.map((line, i) => (
        <span key={line} className="fh-mask">
          <span className={i ? "im-line accent" : "im-line"} style={rise(prog(s, 0.2 + i * 0.4, 0.5))}>
            {line}
          </span>
        </span>
      ))}
    </div>
  );
}
