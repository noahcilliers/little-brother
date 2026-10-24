import type { CatchKind } from "./board-time";
import { kTokens } from "./format";

/** One look per catch kind, shared by edges, badges, chips, counts and the legend. */
export const CATCH_STYLE: Record<CatchKind, { color: string; dash: string; name: string }> = {
  conflict: { color: "var(--hot)", dash: "7 5", name: "conflict" },
  duplicate: { color: "var(--warn)", dash: "2 4", name: "duplicate" },
  stale: { color: "var(--warn)", dash: "2 4", name: "stale" },
  ordering: { color: "var(--muted)", dash: "4 4", name: "ordering" },
  takeover: { color: "var(--ink)", dash: "1 3", name: "takeover" },
};

/** The chip text, with the saving when known: "duplicate · saved ~6.2k". Always "~": it is an estimate. */
export function chipText(c: { chip: string; saved?: number }): string {
  return c.saved ? `${c.chip} · saved ~${kTokens(c.saved)}` : c.chip;
}
