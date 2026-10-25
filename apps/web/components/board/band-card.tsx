import type { BoardShared } from "@/lib/api";
import { fitText } from "@/lib/label-fit";

const CHAR = 6.4;
const MAX_W = 380;
const PAD = 10;

/** The full text of a lesson or decision, floated above its marker while hovered or selected. */
export function BandCard({
  n,
  x,
  y,
  width,
  viewLeft,
}: {
  n: BoardShared;
  x: number;
  y: number;
  /** Graph width: the card stays inside it. */
  width: number;
  viewLeft: number;
}) {
  const inner = MAX_W - 2 * PAD;
  const label = fitText(n.label, inner, CHAR);
  const note = n.note && n.note !== n.label ? fitText(n.note, inner, CHAR * 0.92) : "";
  const textW = Math.max(label.length * CHAR, note.length * CHAR * 0.92, 60);
  const w = Math.min(MAX_W, textW + 2 * PAD);
  const h = note ? 44 : 26;
  const left = Math.max(viewLeft + 4, Math.min(x - 16, width - w - 4));
  // Above the marker, where the row's own bars end; the band below may be the graph's last pixels.
  const top = y - 14 - h;
  return (
    <g pointerEvents="none">
      <rect
        x={left}
        y={top}
        width={w}
        height={h}
        rx={8}
        fill="var(--panel)"
        stroke="var(--line)"
        style={{ filter: "drop-shadow(0 4px 10px color-mix(in srgb, var(--ink) 14%, transparent))" }}
      />
      <text
        x={left + PAD}
        y={top + 17}
        fontFamily="var(--mono)"
        fontSize={11}
        fontWeight={500}
        fill="var(--ink)"
      >
        {label}
      </text>
      {note ? (
        <text x={left + PAD} y={top + 34} fontFamily="var(--sans)" fontSize={10.5} fill="var(--muted)">
          {note}
        </text>
      ) : null}
    </g>
  );
}
