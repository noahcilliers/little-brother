import type { VerifyBadge } from "@/lib/api";
import type { Lookup } from "@/lib/board-time";

/** `lb verify` results: a pill in the lessons band once the branches were merged and tested. */
export function VerifyBadges({
  verifies,
  lookup,
  t,
}: {
  verifies: VerifyBadge[];
  lookup: Lookup;
  t: number;
}) {
  const y = lookup.layout.height - 22 - 34;
  return (
    <g>
      {verifies.map((v) => {
        if (t < v.t) return null;
        const width = 44 + v.text.length * 6.6;
        const x = Math.max(4, Math.min(lookup.layout.xAt(v.t) - 28, lookup.layout.width - width - 6));
        return (
          <g key={v.id}>
            <rect x={x} y={y} width={width} height={30} rx={15} fill="var(--panel)" stroke="var(--line)" />
            {v.ok ? (
              <path
                d={`M${x + 16} ${y + 15} l4 4 l8 -9`}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            ) : (
              <path
                d={`M${x + 16} ${y + 10} l9 9 M${x + 25} ${y + 10} l-9 9`}
                stroke="var(--hot)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            )}
            <text x={x + 34} y={y + 19} fontFamily="var(--mono)" fontSize={11} fill="var(--ink)">
              {v.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
