import type { BoardDecision } from "@/lib/api";
import { lineKind, markTokens } from "@/lib/diff-tokens";

type Side = BoardDecision["sides"][number];

function Diff({ preview, tokens }: { preview?: string; tokens: string[] }) {
  if (!preview) return <p className="empty">No code captured for this change.</p>;
  return (
    <pre className="diff">
      {preview.split("\n").map((line, i) => (
        // Lines of one preview never reorder, so the index is a stable key.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <span key={i} className={`dl ${lineKind(line)}`}>
          {markTokens(line, lineKind(line) === "add" ? tokens : []).map((part, j) =>
            part.mark ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: parts of one line never reorder
              <mark key={j}>{part.text}</mark>
            ) : (
              part.text
            ),
          )}
          {"\n"}
        </span>
      ))}
    </pre>
  );
}

/** One side of a decision: whose change, which task, which file, and the code itself. */
export function DecisionSide({
  side,
  color,
  keyHint,
  tokens,
}: {
  side: Side;
  color: string;
  keyHint: string;
  tokens: string[];
}) {
  return (
    <section className="dside">
      <header>
        <i style={{ background: color }} />
        <b style={{ color }}>{side.who}</b>
        <span className="kbd">{keyHint}</span>
      </header>
      <div className="dsubject">{side.subject}</div>
      {side.file ? <div className="dfile">{side.file}</div> : null}
      <Diff preview={side.preview} tokens={tokens} />
    </section>
  );
}
