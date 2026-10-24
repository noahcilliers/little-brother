import type { ReactNode } from "react";

const SAMPLE = "var(--agent-1)";
const SAMPLE_FILL = "color-mix(in srgb, var(--agent-1) 16%, transparent)";

function Bar({ stroke, fill, dash }: { stroke: string; fill: string; dash?: string }) {
  return (
    <rect
      x={1}
      y={2}
      width={26}
      height={10}
      rx={4}
      fill={fill}
      stroke={stroke}
      strokeWidth={1.4}
      strokeDasharray={dash}
    />
  );
}

const ITEMS: [ReactNode, string][] = [
  [<Bar key="b" stroke={SAMPLE} fill={SAMPLE_FILL} />, "task (agent's own plan step)"],
  [
    <g key="a">
      <rect x={1} y={2} width={26} height={9} rx={4} fill={SAMPLE_FILL} stroke={SAMPLE} strokeWidth={1.2} />
      <circle cx={8} cy={11} r={2.6} fill={SAMPLE} />
      <circle cx={18} cy={11} r={2.6} fill={SAMPLE} />
    </g>,
    "actions",
  ],
  [
    <Bar key="g" stroke="var(--faint)" fill="color-mix(in srgb, var(--faint) 18%, transparent)" dash="4 3" />,
    "abandoned / superseded",
  ],
  [
    <g key="s">
      <rect x={1} y={2} width={16} height={10} rx={4} fill="none" stroke="var(--agent-2)" strokeWidth={1.4} />
      <path d="M21 0 V14" stroke="var(--warn)" strokeWidth={3} />
    </g>,
    "stopped",
  ],
  [
    <path
      key="c"
      d="M2 12 Q14 -4 26 12"
      fill="none"
      stroke="var(--hot)"
      strokeWidth={2}
      strokeDasharray="4 3"
    />,
    "conflict",
  ],
  [
    <path key="d" d="M2 7 H26" stroke="var(--warn)" strokeWidth={2} strokeDasharray="2 3" />,
    "duplicate / stale",
  ],
  [<path key="x" d="M14 1 L20 7 L14 13 L8 7 Z" fill={SAMPLE} />, "decision"],
];

export function Legend() {
  return (
    <div className="legend">
      {ITEMS.map(([svg, label]) => (
        <span key={label}>
          <svg viewBox="0 0 28 14" aria-hidden="true">
            {svg}
          </svg>
          {label}
        </span>
      ))}
    </div>
  );
}
