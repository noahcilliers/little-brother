import { typed } from "./film-clock";
import { Terminal } from "./mockups";
import { shownAt, TYPE_CPS, type TermLine } from "./terminal-script";

const MARK: Partial<Record<TermLine[1], string>> = { say: "⏺", tool: "⏺", out: "⎿", ok: "⎿ ✓" };

function Line({ line }: { line: TermLine }) {
  const [, kind, text, head] = line;
  if (kind === "deny" || kind === "warn" || kind === "decided") {
    return (
      <div className={`t-block ${kind}`}>
        <b>{head}</b>
        <span>{text}</span>
      </div>
    );
  }
  if (kind === "type" || kind === "remote") {
    return (
      <div className="t-prompt">
        <span>›</span> {text}
        {kind === "remote" ? <em>from Remote Control · phone</em> : null}
      </div>
    );
  }
  if (kind === "lb") return <div className="t-lb">{text}</div>;
  return (
    <div className={`t-${kind}`}>
      <span className="t-mark">{MARK[kind]}</span> {text}
    </div>
  );
}

/** A Claude Code session: scrollback that grows on the film clock, and the input box being typed into. */
export function StoryTerminal({
  s,
  lines,
  title,
  ...frame
}: {
  s: number;
  lines: TermLine[];
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const shown = lines.filter((l) => shownAt(l) <= s);
  const typing = lines.find((l) => l[1] === "type" && s >= l[0] && s < shownAt(l));
  const draft = typing ? typed(typing[2], s, typing[0], TYPE_CPS) : "";
  const newest = shown[shown.length - 1];
  return (
    <Terminal title={title} {...frame}>
      <div className="t-scroll">
        {shown.map((l) => (
          <div key={`${l[0]}${l[1]}`} className={l === newest && s - shownAt(l) < 0.5 ? "t-row enter" : "t-row"}>
            <Line line={l} />
          </div>
        ))}
      </div>
      <div className={draft ? "t-input on" : "t-input"}>
        <span>›</span> {draft}
        <i className="t-caret" />
      </div>
    </Terminal>
  );
}
