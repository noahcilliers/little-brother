import { countUp } from "./film-fx";
import { after, Bar, MetricCard } from "./metric-card";

// Cost, providers and the learning loop: qualitative where we have no measured number, and labelled so.

export function CostCard({ p }: { p: number }) {
  return (
    <MetricCard title="Cost" source="tokens saved: 6-agent replay estimate · judge spend shown qualitatively" p={p}>
      <p className="mc-lead">The judge only runs on pairs the rules can't settle.</p>
      <Bar label="tokens the catches saved" value={10} max={10} p={after(p, 0.3)} shown="≈ 8.5k" />
      <Bar label="judge's own spend" value={1.2} max={10} p={after(p, 0.5)} shown="small" tag="qualitative" hatch />
      <div className="mc-targets" style={{ opacity: after(p, 0.9, 0.4) }}>
        <span>
          judge calls per event &lt; 1 <em>target</em>
        </span>
      </div>
    </MetricCard>
  );
}

// biome-ignore format: tabular scenario data
const PROVIDERS: [name: string, role: string, shipped: boolean][] = [
  ["Gemini", "judge (default) + embeddings", true],
  ["Claude", "judge", true],
  ["OpenAI", "bring your own adapter", false],
  ["Local model", "bring your own adapter", false],
];

export function ProvidersCard({ p }: { p: number }) {
  return (
    <MetricCard title="Providers" source="Judge and Embedder are interfaces; adapters live in classify/adapters" p={p}>
      <ul className="mc-providers">
        {PROVIDERS.map(([name, role, shipped], i) => (
          <li key={name} className={shipped ? "on" : "slot"} style={{ opacity: after(p, 0.2 + i * 0.15, 0.3) }}>
            <b>{name}</b>
            <span>{role}</span>
            <em>{shipped ? "shipped" : "not supported yet"}</em>
          </li>
        ))}
      </ul>
    </MetricCard>
  );
}

export function LearningCard({ p }: { p: number }) {
  const a = after(p, 0.3);
  return (
    <MetricCard title="Learning loop" source="stale paths avoided: 6-agent replay · the rest describes what the code does" p={p}>
      <div className="mc-big">
        {countUp(2, a)}
        <small>failed paths pruned before a retry</small>
      </div>
      <ul className="mc-list">
        <li style={{ opacity: after(p, 0.5, 0.3) }}>Lessons from failed trajectories, reused by later agents</li>
        <li style={{ opacity: after(p, 0.65, 0.3) }}>Every Approve / Dismiss collected as a label</li>
        <li style={{ opacity: after(p, 0.8, 0.3) }}>Labelled verdicts retrieved as few-shot examples</li>
      </ul>
    </MetricCard>
  );
}
