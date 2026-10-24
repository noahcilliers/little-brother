import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATASETS, flag, ghApi, ghRemaining, parseCsv, pool, rng, shuffle } from "./common";

// AgenticFlict (arXiv 2604.03551, doi:10.5281/zenodo.19396916) labels each agentic PR by a deterministic
// `git merge` of its head into the base branch. That is a pair of concurrent workstreams on one merge base:
// the PR's own changes vs the base branch's drift since it forked. The dataset ships no code, so this
// fetches both sides' diffs from the GitHub compare API (cached; re-runs only fetch what is missing).
//
//   npx tsx scripts/classifier/datasets/agenticflict-fetch.ts --conflicts 600 --clean 1800 --seed 1 [--state CLOSED]

const ROOT = join(DATASETS, "agenticflict");
const CSV = join(ROOT, "data/clean/agenticflict_pr_clean.csv");
const CACHE = join(ROOT, "api");
const MIN_BUDGET = 150;
const MAX_FILES = 40;
const PER_REPO = 3;

type CompareFile = { filename: string; status: string; patch?: string; previous_filename?: string };
type Compare = { merge_base_commit?: { sha?: string }; files?: CompareFile[] };
export type FetchedPr = {
  prKey: string;
  repo: string;
  conflict: boolean;
  agent: string;
  mergeBase?: string;
  pr?: CompareFile[];
  drift?: CompareFile[];
  error?: string;
};

export const cachePath = (prKey: string) => join(CACHE, `${createHash("sha1").update(prKey).digest("hex")}.json`);

const slim = (files: CompareFile[] = []): CompareFile[] =>
  files.map((f) => ({
    filename: f.filename,
    status: f.status,
    ...(f.patch ? { patch: f.patch } : {}),
    ...(f.previous_filename ? { previous_filename: f.previous_filename } : {}),
  }));

async function fetchOne(row: Record<string, string>): Promise<FetchedPr> {
  const base = { prKey: row.pr_key ?? "", repo: row.repo_full_name ?? "", conflict: row.conflict_label === "TRUE", agent: row.agent ?? "" };
  try {
    const head = JSON.parse(await ghApi(`repos/${base.repo}/compare/${row.base_oid}...${row.head_oid}`)) as Compare;
    const mergeBase = head.merge_base_commit?.sha;
    if (!mergeBase) return { ...base, error: "no merge base" };
    // No drift means nothing concurrent to pair with; the merge is trivially clean.
    if (mergeBase === row.base_oid) return { ...base, mergeBase, pr: slim(head.files), drift: [] };
    const drift = JSON.parse(await ghApi(`repos/${base.repo}/compare/${mergeBase}...${row.base_oid}`)) as Compare;
    return { ...base, mergeBase, pr: slim(head.files), drift: slim(drift.files) };
  } catch (e) {
    return { ...base, error: String(e).replace(/\s+/g, " ").slice(0, 200) };
  }
}

/** Equal numbers of conflicting and clean PRs, at most a few per repository so no repo dominates. */
export function sample(
  rows: Record<string, string>[],
  conflicts: number,
  clean: number,
  seed: number,
  state?: string,
): Record<string, string>[] {
  const r = rng(seed);
  const ok = rows.filter((x) => {
    if (state && x.gh_state !== state) return false;
    const files = Number(x.pr_changed_files);
    return x.status_code?.startsWith("OK_") && files >= 1 && files <= MAX_FILES && x.base_oid && x.head_oid;
  });
  const out: Record<string, string>[] = [];
  for (const [label, want] of [["TRUE", conflicts], ["FALSE", clean]] as const) {
    const perRepo = new Map<string, number>();
    for (const x of shuffle(ok.filter((y) => y.conflict_label === label), r)) {
      const n = perRepo.get(x.repo_full_name ?? "") ?? 0;
      if (n >= PER_REPO) continue;
      perRepo.set(x.repo_full_name ?? "", n + 1);
      out.push(x);
      if (out.filter((y) => y.conflict_label === label).length >= want) break;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  // Most clean PRs have no base drift at all (nothing to pair), so clean ones are over-sampled.
  const conflicts = Number(flag(argv, "conflicts", "600"));
  const clean = Number(flag(argv, "clean", "1800"));
  const seed = Number(flag(argv, "seed", "1"));
  mkdirSync(CACHE, { recursive: true });
  const picked = sample(parseCsv(readFileSync(CSV, "utf8")), conflicts, clean, seed, flag(argv, "state", "") || undefined).filter((x) => !existsSync(cachePath(x.pr_key ?? "")));
  console.log(`${picked.length} PRs to fetch`);
  let budget = await ghRemaining();
  let done = 0;
  await pool(picked, 6, async (row) => {
    if (budget < MIN_BUDGET) return;
    budget -= 2;
    const got = await fetchOne(row);
    writeFileSync(cachePath(got.prKey), JSON.stringify(got));
    done += 1;
    if (done % 50 === 0) console.log(`${done}/${picked.length} (budget ~${budget})`);
  });
  console.log(`fetched ${done}; remaining budget ${await ghRemaining()}`);
}

if (process.argv[1]?.endsWith("agenticflict-fetch.ts")) main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
