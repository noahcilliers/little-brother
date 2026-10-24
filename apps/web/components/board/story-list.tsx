import type { SessionLine } from "@/lib/api";
import { elapsed } from "@/lib/format";

function tone(kind: SessionLine["kind"]): string {
  if (kind === "fail" || kind === "lb") return "bad";
  if (kind === "lbwarn") return "warn";
  return kind === "ok" || kind === "done" ? "good" : "";
}

/** A task's story: its own session lines, as a small timeline in the side panel. */
export function StoryList({ lines, start }: { lines: SessionLine[]; start: number }) {
  if (lines.length === 0) return null;
  return (
    <ol className="story">
      {lines.map((l) => (
        <li key={l.id} className={tone(l.kind)}>
          <time>{elapsed(l.t, start)}</time>
          {l.kind === "lb" || l.kind === "lbwarn" ? (
            <>
              <b>little brother · {l.head}</b>
              <small className="clamp" title={l.text}>
                {l.text}
              </small>
            </>
          ) : l.kind === "task" ? (
            "started"
          ) : (
            <span className="clamp" title={l.text}>
              {l.kind === "done" ? l.text.replace(/^[☑☒] /, "ended: ") : l.text}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
