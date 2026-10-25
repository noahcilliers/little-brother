import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type ClassifiedNode,
  type DiffFile,
  diffTouches,
  type Gold,
  type LabelledPair,
  labelPair,
  pairMeta,
  scoreCandidates,
} from "../../../packages/core/src/index";
import { DATASETS } from "./common";

// Two diffs on one merge base → one labelled pair, retrieved the way the live classifier would (step 2), so
// the features match what the tier sees in production. Pairs step 2 would never retrieve are dropped.

export const PAIRS_DIR = join(DATASETS, "pairs");

export type Side = { id: string; agentId: string; files: DiffFile[]; at: number; text?: string };

export function nodeOf(side: Side): ClassifiedNode {
  const { touches, references } = diffTouches(side.files);
  const paths = [...new Set(side.files.map((f) => f.path))];
  return {
    id: side.id,
    agentId: side.agentId,
    kind: "action",
    verb: "EDIT",
    text:
      side.text ?? `EDIT ${paths.slice(0, 3).join(" ")}${paths.length > 3 ? ` +${paths.length - 3}` : ""}`,
    outcome: "open",
    touches,
    references,
    at: side.at,
  };
}

export function prPair(
  id: string,
  group: string,
  next: Side,
  other: Side,
  gold: Gold | ((features: number[]) => Gold | null),
  meta: Record<string, string | number | boolean>,
): LabelledPair | null {
  const n = nodeOf(next);
  const o = nodeOf(other);
  const [pair] = scoreCandidates(n, [{ node: o, failedMemory: false }]);
  if (!pair) return null;
  const label = typeof gold === "function" ? { goldFrom: gold } : { gold };
  return labelPair({ id, group, pair, ...label, meta: { ...pairMeta(n, o), ...meta } });
}

export function writeJsonl(path: string, rows: LabelledPair[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
}

export function tally(rows: LabelledPair[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = r.gold?.relation ?? "unlabelled";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
