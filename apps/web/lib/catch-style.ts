import type { CatchKind } from "./board-time";
import { kTokens } from "./format";

/** One look per catch kind, shared by edges, badges, chips, counts and the legend. */
export const CATCH_STYLE: Record<CatchKind, { color: string; name: string }> = {
  conflict: { color: "var(--hot)", name: "conflict" },
  duplicate: { color: "var(--warn)", name: "duplicate" },
  stale: { color: "var(--warn)", name: "stale" },
  ordering: { color: "var(--muted)", name: "ordering" },
  takeover: { color: "var(--ink)", name: "takeover" },
};

/** The chip text, with the saving when known: "duplicate · saved ~6.2k". Always "~": it is an estimate. */
export function chipText(c: { chip: string; saved?: number }): string {
  return c.saved ? `${c.chip} · saved ~${kTokens(c.saved)}` : c.chip;
}
