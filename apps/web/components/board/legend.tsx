import type { ReactNode } from "react";
import { CATCH_STYLE } from "@/lib/catch-style";
import { type IconName, InlineIcon } from "./icons";

const SAMPLE = "var(--agent-1)";
const SAMPLE_FILL = "color-mix(in srgb, var(--agent-1) 16%, transparent)";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 28 14" aria-hidden="true">
      {children}
    </svg>
  );
}

const icon = (name: IconName, color: string) => <InlineIcon name={name} color={color} size={14} />;
const edge = (kind: keyof typeof CATCH_STYLE) => (
  <Svg>
    <path d="M2 10 Q14 0 26 10" fill="none" stroke={CATCH_STYLE[kind].color} strokeWidth={2} strokeDasharray={CATCH_STYLE[kind].dash} />
  </Svg>
);

const ITEMS: [ReactNode, string][] = [
  [icon("flag", SAMPLE), "goal"],
  [
    <Svg key="b">
      <rect x={1} y={2} width={26} height={10} rx={4} fill={SAMPLE_FILL} stroke={SAMPLE} strokeWidth={1.4} />
    </Svg>,
    "task",
  ],
  [
    <Svg key="r">
      <line x1={2} y1={7} x2={26} y2={7} stroke="var(--line)" />
      <circle cx={8} cy={7} r={2.2} fill="var(--faint)" />
      <circle cx={18} cy={7} r={2.2} fill="var(--faint)" />
    </Svg>,
    "routine action",
  ],
  [
    <Svg key="a">
      <rect x={1} y={1} width={26} height={9} rx={4} fill={SAMPLE_FILL} stroke={SAMPLE} strokeWidth={1.2} />
      <circle cx={9} cy={10} r={2.8} fill={SAMPLE} />
      <circle cx={19} cy={10} r={2.8} fill={SAMPLE} />
    </Svg>,
    "action",
  ],
  [icon("wall", "var(--warn)"), "stopped"],
  [<span key="c">{icon("bolt", "var(--hot)")}{edge("conflict")}</span>, "conflict"],
  [<span key="d">{icon("squares", "var(--warn)")}{edge("duplicate")}</span>, "duplicate"],
  [<span key="s">{icon("retry", "var(--warn)")}{edge("stale")}</span>, "stale (already failed)"],
  [<span key="o">{icon("arrowBar", "var(--muted)")}{edge("ordering")}</span>, "ordering"],
  [icon("diamond", SAMPLE), "decision"],
  [icon("hexagon", "var(--ink)"), "lesson"],
];

/** How to read the board, with exactly the icons it draws. */
export function Legend() {
  return (
    <div className="legend">
      <b>How to read</b>
      {ITEMS.map(([svg, label]) => (
        <span key={label}>
          {svg}
          {label}
        </span>
      ))}
    </div>
  );
}
