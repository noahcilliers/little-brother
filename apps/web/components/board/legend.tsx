import { Icon } from "./glyph";

const SAMPLE = "var(--agent-1)";

function Line({ stroke, dash, bend }: { stroke: string; dash: string; bend?: boolean }) {
  return (
    <svg viewBox="0 0 24 12" className="icon" aria-hidden="true">
      <path
        d={bend ? "M1 10 Q12 -4 23 10" : "M1 6 H23"}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeDasharray={dash}
      />
    </svg>
  );
}

export function Legend() {
  return (
    <div className="legend">
      <span>
        <svg viewBox="-16 -9 32 18" className="icon" aria-hidden="true">
          <rect
            x={-14}
            y={-7}
            width={28}
            height={14}
            rx={7}
            fill="var(--panel)"
            stroke={SAMPLE}
            strokeWidth={1.6}
          />
        </svg>
        intent
      </span>
      <span>
        <Icon glyph="edit" color={SAMPLE} />
        action
      </span>
      <span>
        <Icon glyph="ok" color={SAMPLE} />
        tests pass
      </span>
      <span>
        <Icon glyph="fail" color={SAMPLE} />
        failed
      </span>
      <span>
        <Icon glyph="blocked" color={SAMPLE} why="duplicate" />
        blocked
      </span>
      <span>
        <Icon glyph="superseded" color={SAMPLE} />
        superseded
      </span>
      <span>
        <Line stroke="var(--faint)" dash="4 3" />
        abandoned
      </span>
      <span>
        <Icon glyph="lesson" color={SAMPLE} />
        lesson
      </span>
      <span>
        <Icon glyph="decision" color={SAMPLE} />
        decision
      </span>
      <span>
        <Icon glyph="verify" color={SAMPLE} />
        verified
      </span>
      <span>
        <Line stroke="var(--hot)" dash="4 3" bend />
        conflict
      </span>
      <span>
        <Line stroke="var(--warn)" dash="2 3" />
        duplicate / stale
      </span>
    </div>
  );
}
