import type { BenchRun } from "@lb/core";

/** A share in [0, 1] as a whole percent; a dash when no counted run reported it. */
export const pct = (x: number | null): string => (x === null ? "–" : `${Math.round(x * 100)}%`);

export const usd = (x: number | null): string => (x === null ? "–" : `$${x.toFixed(2)}`);

/** The harness's arm names, as the landing says them. */
export function armName(arm: string): string {
  if (arm === "on") return "LB on";
  if (arm === "off") return "LB off";
  return arm;
}

/** What a feed line says happened: the merge first, then what Little Brother caught. */
export function runOutcome(r: BenchRun): string {
  if (r.voided) return "voided · rate limited";
  const merge =
    r.mergeConflict === true
      ? "merge conflict"
      : r.finalSuccess === true
        ? "merged, checks pass"
        : r.finalSuccess === false
          ? "merged, checks fail"
          : "no merge result";
  if (r.arm !== "on") return merge;
  const caught = r.hits ? ` · caught ${r.hits}` : "";
  const missed = r.misses ? ` · missed ${r.misses}` : "";
  return `${merge}${caught}${missed}`;
}

/** Whole seconds under two minutes, else minutes. */
export function duration(sec: number): string {
  return sec < 120 ? `${Math.round(sec)} s` : `${Math.round(sec / 60)} min`;
}
