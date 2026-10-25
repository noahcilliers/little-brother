import type { BoardShared } from "./api";
import type { Layout } from "./board-layout";
import { CHAR_W, fitText } from "./label-fit";

// Marker half-width plus padding on each side of an inline label.
const LEAD = 15;
const TRAIL = 10;
// A stub like "pr…" reads as noise; below this the marker stands alone and the hover card carries the text.
const MIN_CHARS = 6;

/**
 * The inline text beside each lesson or decision marker: right of the marker and cut before the next marker in
 * the same band, so neighbours never overlap. Empty when too little would fit to read.
 */
export function bandLabels(shared: BoardShared[], layout: Layout): Map<string, string> {
  const out = new Map<string, string>();
  const rows = new Map<string, BoardShared[]>();
  for (const s of [...shared].sort((a, b) => a.t - b.t)) {
    const row = layout.bandRow.get(s.id);
    if (!row) continue;
    rows.set(row.agentId, [...(rows.get(row.agentId) ?? []), s]);
  }
  for (const list of rows.values()) {
    list.forEach((s, i) => {
      const x = layout.xAt(s.t);
      const next = list[i + 1];
      const end = next ? layout.xAt(next.t) - TRAIL : layout.width - 6;
      const text = fitText(s.label, end - x - LEAD, CHAR_W.band);
      out.set(s.id, text.length >= Math.min(s.label.length, MIN_CHARS) ? text : "");
    });
  }
  return out;
}
