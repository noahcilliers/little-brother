import { splitComparison } from "@/lib/git";

/** The escalation's LLM side-by-side, laid out in two columns when it labels its sides. */
export function Comparison({ text }: { text: string }) {
  const split = splitComparison(text);
  return (
    <div className="rv-compare">
      <span className="label">side by side</span>
      {split ? (
        <div className="cmp-cols">
          <div>
            <b className="cmp-head">{split.leftHead}</b>
            <pre>{split.left}</pre>
          </div>
          <div>
            <b className="cmp-head">{split.rightHead}</b>
            <pre>{split.right}</pre>
          </div>
        </div>
      ) : (
        <pre className="cmp-whole">{text}</pre>
      )}
    </div>
  );
}
