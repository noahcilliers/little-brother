import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ClassifiedNode,
  type Gold,
  isFailureMemory,
  type LabelledPair,
  labelPair,
  negativeRelation,
  pairMeta,
  RELATIONS,
  type Relation,
  reasonsFromEvidence,
  toClassifiedNode,
} from "@lb/core";
import type { FindingType } from "./case";
import { type Row, RunFile } from "./run-file";
import { isFinding, pairKey } from "./score";

// Turns live eval runs into gold-labelled training pairs for the pair model, using the scorer's own
// definitions (score.ts): a row on an expected pair whose clash materialized is a gold positive; any row
// on another pair, or in a control, is a gold negative. Rows on an expected pair whose clash never
// happened, and `normal` rows there, keep only their teacher label.

const isRelation = (r: string | undefined): r is Relation =>
  !!r && (RELATIONS as readonly string[]).includes(r);
const TYPE_RELATION: Record<FindingType, Relation> = {
  duplicate: "duplicate",
  conflict: "textual_conflict",
  stale: "repeats_failure",
};

/** Runs from before the snapshot carried nodes: rebuild what the compact signature line says. */
export function nodeFromText(
  id: string,
  agentId: string,
  text: string,
  kind?: ClassifiedNode["kind"],
): ClassifiedNode {
  const [verb = "ACT", second = ""] = text.split(" ");
  const files = [...new Set(text.match(/[\w.-]+(?:\/[\w.-]+)+\.\w+|\b[\w-]+\.(?:ts|tsx|js|json)\b/g) ?? [])];
  const topic = /^[a-z]+\.[a-z.]+$/.test(second) && !files.includes(second) ? second : undefined;
  const k = kind ?? (verb === "PLAN" ? "intent" : verb === "LEARN" ? "knowledge" : "action");
  return {
    id,
    agentId,
    kind: k,
    verb,
    text,
    ...(topic ? { topic } : {}),
    outcome: /→ FAIL/.test(text) ? "failed" : k === "knowledge" ? "succeeded" : "open",
    touches: files.map((path) => ({ path, op: "write" as const })),
    references: [],
    at: 0,
  };
}

function goldFor(run: RunFile, r: Row): ((f: number[]) => Gold | null) | null {
  const negative = (f: number[]): Gold => ({ relation: negativeRelation(f), origin: "eval" });
  if (run.score.control) return negative;
  const e = run.score.expectations.find((x) => pairKey(x.agents) === pairKey(r.agents));
  if (!e) return negative;
  if (!isFinding(r) || !e.materialized) return null;
  const expected = isRelation(e.relation) ? e.relation : TYPE_RELATION[e.type as FindingType];
  const relation = r.type === e.type && isRelation(r.relation) ? r.relation : expected;
  return relation ? () => ({ relation, origin: "eval" }) : null;
}

export type ExportSummary = {
  runs: number;
  rows: number;
  gold: number;
  reconstructed: number;
  missesWithoutRows: number;
};

/** All labelled pairs in one run.json; empty for errored runs and runs with Little Brother off. */
export function pairsFromRun(run: RunFile): { rows: LabelledPair[]; reconstructed: number } {
  if (run.error || (run.arm && run.arm !== "on") || !run.snapshot) return { rows: [], reconstructed: 0 };
  const group = run.code ?? `${run.caseId}-${run.variant}-${run.run}`;
  let reconstructed = 0;
  const rows: LabelledPair[] = [];
  for (const r of run.snapshot.classifications) {
    if (r.againstText === null || !isRelation(r.relation)) continue;
    const [a = "a", b = "b"] = r.agents;
    const full = r.pair?.other ? { next: r.pair.next, other: r.pair.other } : null;
    if (!full) reconstructed += 1;
    const next = full ? toClassifiedNode(full.next) : nodeFromText(`${r.id}:next`, a, r.nodeText, r.nodeKind);
    const other = full ? toClassifiedNode(full.other) : nodeFromText(`${r.id}:other`, b, r.againstText);
    const gold = goldFor(run, r);
    rows.push(
      labelPair({
        id: r.id,
        group,
        pair: {
          next,
          other,
          retrievalScore: r.retrievalScore ?? 0.5,
          reasons: reasonsFromEvidence(r.pair?.evidence ?? r.evidence),
          failedMemory: isFailureMemory(other),
        },
        teacher: {
          relation: r.relation,
          direction: r.direction ?? "none",
          confidence: r.confidence,
          source: r.source,
        },
        judge:
          r.source === "llm"
            ? { relation: r.relation, confidence: r.confidence, latencyMs: r.latencyMs }
            : null,
        ...(gold ? { goldFrom: gold } : {}),
        meta: { ...pairMeta(next, other), caseId: run.caseId, variant: run.variant, reconstructed: !full },
      }),
    );
  }
  return { rows, reconstructed };
}

function runFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...runFiles(p));
    else if (name === "run.json") out.push(p);
  }
  return out;
}

/** `--export-pairs <results dir>`: every run.json under it → <dir>/pairs.jsonl. */
export function exportPairs(dir: string, out = join(dir, "pairs.jsonl")): ExportSummary {
  const summary: ExportSummary = { runs: 0, rows: 0, gold: 0, reconstructed: 0, missesWithoutRows: 0 };
  const lines: string[] = [];
  for (const file of runFiles(dir)) {
    const parsed = RunFile.safeParse(JSON.parse(readFileSync(file, "utf8")));
    if (!parsed.success) continue;
    summary.runs += 1;
    const { rows, reconstructed } = pairsFromRun(parsed.data);
    summary.reconstructed += reconstructed;
    summary.missesWithoutRows += parsed.data.score.expectations.filter((e) => e.outcome === "miss").length;
    for (const r of rows) {
      lines.push(JSON.stringify(r));
      summary.rows += 1;
      if (r.gold) summary.gold += 1;
    }
  }
  writeFileSync(out, lines.length ? `${lines.join("\n")}\n` : "");
  return summary;
}
