import { POLICY, type Thresholds } from "./decide";
import { RELATIONS, type Relation } from "./types";

export type Labeled = { relation: string; feedback?: string };
export type RelationStats = { confirmed: number; falsePositive: number; precision: number | null };

export const TARGET_PRECISION = 0.85;
const MIN_LABELS = 10;
const RAISE = 0.05;
const LOWER = 0.02;

export function precisionByRelation(rows: Labeled[]): Partial<Record<Relation, RelationStats>> {
  const out: Partial<Record<Relation, RelationStats>> = {};
  for (const r of RELATIONS) {
    const labeled = rows.filter((x) => x.relation === r);
    const confirmed = labeled.filter((x) => x.feedback === "confirmed").length;
    const falsePositive = labeled.filter((x) => x.feedback === "false_positive").length;
    if (confirmed + falsePositive === 0) continue;
    out[r] = { confirmed, falsePositive, precision: confirmed / (confirmed + falsePositive) };
  }
  return out;
}

/**
 * §5 threshold calibration: with enough labels, raise a relation's action threshold while precision is
 * under target and ease it back toward the default when precision is comfortably above.
 */
export function recalibrate(
  current: Thresholds,
  stats: Partial<Record<Relation, RelationStats>>,
): Thresholds {
  const next: Thresholds = { ...current };
  for (const [relation, s] of Object.entries(stats) as [Relation, RelationStats][]) {
    if (s.precision === null || s.confirmed + s.falsePositive < MIN_LABELS) continue;
    const base = POLICY[relation].threshold;
    if (base === 0) continue;
    const now = current[relation] ?? base;
    if (s.precision < TARGET_PRECISION) next[relation] = Math.min(0.99, Number((now + RAISE).toFixed(2)));
    else if (s.precision > 0.95) next[relation] = Math.max(base, Number((now - LOWER).toFixed(2)));
  }
  return next;
}
