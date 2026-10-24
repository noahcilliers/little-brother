import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DiffFile, LabelledPair } from "../../../packages/core/src/index";
import type { FetchedPr } from "./agenticflict-fetch";
import { DATASETS, parseCsv } from "./common";
import { PAIRS_DIR, prPair, tally, writeJsonl } from "./pr-pairs";

// AgenticFlict → pair JSONL. next = the agent PR's changes, other = the base branch's drift since the PR
// forked; gold = the dataset's merge simulation: conflict → textual_conflict, clean → overlap_compatible,
// per PR and per shared file (using the dataset's conflict-file list).
//
//   npx tsx scripts/classifier/datasets/agenticflict.ts   (after agenticflict-fetch.ts)

const CACHE = join(DATASETS, "agenticflict/api");

const STATUS: Record<string, DiffFile["status"]> = { added: "added", removed: "removed", renamed: "renamed" };

function files(xs: FetchedPr["pr"]): DiffFile[] {
  return (xs ?? []).map((f) => ({
    path: f.filename,
    ...(f.previous_filename ? { oldPath: f.previous_filename } : {}),
    status: STATUS[f.status] ?? "modified",
    patch: f.patch ?? "",
  }));
}

const MAX_FILE_PAIRS = 5;

/**
 * One PR-level pair, plus file-level pairs for files both sides changed (closer to the live classifier's
 * per-edit nodes). A file is textual_conflict when the simulation reported it among the PR's conflict
 * files; an overlapping file git merged cleanly is overlap_compatible, even inside a conflicting PR.
 */
export function agenticflictRows(pr: FetchedPr, conflicted: ReadonlySet<string>): LabelledPair[] {
  if (pr.error || !pr.pr?.length || !pr.drift?.length) return [];
  const driftFiles = files(pr.drift);
  const prFiles = files(pr.pr);
  const shared = prFiles.filter((f) => driftFiles.some((d) => d.path === f.path));
  // Clean PRs are kept only when they share files with the drift: "same area, merged clean".
  if (!pr.conflict && shared.length === 0) return [];
  const meta = { source: "agenticflict", repo: pr.repo, agent: pr.agent };
  const side = (suffix: string, agentId: string, fs: DiffFile[], at: number) => ({
    id: `${pr.prKey}:${suffix}`,
    agentId,
    files: fs,
    at,
  });
  const out: LabelledPair[] = [];
  const whole = prPair(
    `af:${pr.prKey}`,
    pr.repo,
    side("pr", "agent", prFiles, 3_600_000),
    side("base", "base", driftFiles, 0),
    { relation: pr.conflict ? "textual_conflict" : "overlap_compatible", origin: "dataset" },
    { ...meta, level: "pr" },
  );
  if (whole) out.push(whole);
  for (const f of shared.slice(0, MAX_FILE_PAIRS)) {
    const d = driftFiles.filter((x) => x.path === f.path);
    const relation = conflicted.has(f.path) ? "textual_conflict" : "overlap_compatible";
    const row = prPair(
      `af:${pr.prKey}:${f.path}`,
      pr.repo,
      side(`pr:${f.path}`, "agent", [f], 3_600_000),
      side(`base:${f.path}`, "base", d, 0),
      { relation, origin: "dataset" },
      { ...meta, level: "file" },
    );
    if (row) out.push(row);
  }
  return out;
}

function conflictFiles(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const r of parseCsv(
    readFileSync(join(DATASETS, "agenticflict/data/clean/agenticflict_conflict_files_clean.csv"), "utf8"),
  )) {
    const key = r.pr_key ?? "";
    out.set(key, (out.get(key) ?? new Set()).add(r.file_path ?? ""));
  }
  return out;
}

function main(): void {
  const conflicted = conflictFiles();
  const rows: LabelledPair[] = [];
  let seen = 0;
  for (const name of readdirSync(CACHE)) {
    seen += 1;
    const pr = JSON.parse(readFileSync(join(CACHE, name), "utf8")) as FetchedPr;
    rows.push(...agenticflictRows(pr, conflicted.get(pr.prKey) ?? new Set()));
  }
  const out = join(PAIRS_DIR, "agenticflict.jsonl");
  writeJsonl(out, rows);
  console.log(
    `agenticflict: ${seen} fetched PRs → ${rows.length} pairs ${JSON.stringify(tally(rows))} → ${out}`,
  );
}

main();
