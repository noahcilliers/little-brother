import type { CatchKind } from "./board-time";

/** One look per catch kind, shared by edges, badges, chips, counts and the legend. */
export const CATCH_STYLE: Record<CatchKind, { color: string; dash: string; name: string }> = {
  conflict: { color: "var(--hot)", dash: "7 5", name: "conflict" },
  duplicate: { color: "var(--warn)", dash: "2 4", name: "duplicate" },
  stale: { color: "var(--warn)", dash: "2 4", name: "stale" },
  ordering: { color: "var(--muted)", dash: "4 4", name: "ordering" },
  takeover: { color: "var(--ink)", dash: "1 3", name: "takeover" },
};
