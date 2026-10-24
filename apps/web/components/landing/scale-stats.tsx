const STATS = [
  ["42%", "of committed code is AI-written", "Sonar, State of Code 2026"],
  ["~5×", "the tokens humans use, mostly re-reading context", "OpenRouter, Aug 2026"],
  ["~30%", "lower success for teams of coding agents than solo agents", "CooperBench, 2026"],
] as const;

export function ScaleStats() {
  return (
    <div className="scale">
      <span className="label">The problem at scale</span>
      <div className="scale-row">
        {STATS.map(([big, what, src]) => (
          <div key={big} className="scale-stat">
            <b>{big}</b>
            <span>{what}</span>
            <small className="src">{src}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
