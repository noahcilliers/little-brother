import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATASETS, flag, ghRemaining } from "./common";
import { comments, pr, prFiles, type SearchItem, search, stats } from "./gh-cache";

// Mines labelled PR pairs from popular repositories (gold-ish: the label comes from what maintainers wrote):
//   duplicate            a PR closed with "duplicate of #N" pointing at another PR
//   ordering_dependency  a PR whose body says "depends on / blocked by / requires #N" (another PR)
//   repeats_failure      a reland that was itself reverted: (original attempt, reverted) → (reland)
// plus a pool of recent merged PRs per repo for negatives. Writes github/candidates.jsonl.
//
//   npx tsx scripts/classifier/datasets/github-mine.ts [--per-repo 25]

export const REPOS = [
  "microsoft/vscode",
  "vercel/next.js",
  "facebook/react",
  "microsoft/TypeScript",
  "angular/angular",
  "nodejs/node",
  "home-assistant/core",
  "pandas-dev/pandas",
  "scikit-learn/scikit-learn",
  "pytorch/pytorch",
  "python/cpython",
  "kubernetes/kubernetes",
  "prometheus/prometheus",
  "hashicorp/terraform",
  "cli/cli",
  "grafana/grafana",
  "llvm/llvm-project",
];
const RELAND_REPOS = [
  "llvm/llvm-project",
  "pytorch/pytorch",
  "nodejs/node",
  "microsoft/vscode",
  "python/cpython",
];

export type Candidate = {
  kind: "duplicate" | "ordering_dependency" | "repeats_failure" | "pool";
  repo: string;
  /** The newer PR (classifier `next`) and the one it relates to (`other`). */
  next: number;
  other?: number;
  evidence: string;
};

const OUT = join(DATASETS, "github", "candidates.jsonl");
const MIN_BUDGET = 300;

const DUP = /dup(?:licate|e)?\s+of\s+(?:https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:pull|issues)\/|#)(\d+)/i;
const DEP =
  /\b(?:depends\s+on|blocked\s+by|requires|builds?\s+on(?:\s+top\s+of)?|stacked\s+on)\s+(?:PR\s+)?(?:https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/|#)(\d+)/i;
const REVERTS =
  /Reverts\s+[\w.-]+\/[\w.-]+#(\d+)|This reverts (?:PR\s+)?#(\d+)|revert(?:s|ing)?\s+(?:PR\s+)?#(\d+)/i;

const seen = new Set<string>();
function emit(c: Candidate): void {
  const key = `${c.kind}|${c.repo}|${c.next}|${c.other ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  appendFileSync(OUT, `${JSON.stringify(c)}\n`);
}

const isPr = (i: SearchItem) => i.pull_request !== undefined;

async function duplicates(repo: string, limit: number): Promise<number> {
  let n = 0;
  for (const item of (await search(`repo:${repo} is:pr is:closed is:unmerged "duplicate of"`)).filter(isPr)) {
    if (n >= limit) break;
    let m = DUP.exec(item.body ?? "");
    for (const c of m ? [] : ((await comments(repo, item.number)) ?? [])) {
      m = DUP.exec(c.body ?? "");
      if (m) break;
    }
    const target = Number(m?.[1]);
    if (!target || target === item.number) continue;
    // Only PR-to-PR duplicates: an issue number 404s on the pulls endpoint.
    if (!(await pr(repo, target)) || !(await pr(repo, item.number))) continue;
    emit({ kind: "duplicate", repo, next: item.number, other: target, evidence: m?.[0] ?? "" });
    n += 1;
  }
  return n;
}

async function dependencies(repo: string, limit: number): Promise<number> {
  let n = 0;
  for (const q of [`"depends on #"`, `"blocked by #"`, `"stacked on"`]) {
    for (const item of (await search(`repo:${repo} is:pr ${q}`)).filter(isPr)) {
      if (n >= limit) return n;
      const m = DEP.exec(item.body ?? "");
      const dep = Number(m?.[1]);
      if (!dep || dep === item.number || !(await pr(repo, dep)) || !(await pr(repo, item.number))) continue;
      emit({ kind: "ordering_dependency", repo, next: item.number, other: dep, evidence: m?.[0] ?? "" });
      n += 1;
    }
  }
  return n;
}

const normTitle = (t: string) =>
  t
    .replace(/^(Revert|Reland|Reapply|Recommit)\s*:?\s*/i, "")
    .replace(/^["'“]|["'”]$/g, "")
    .replace(/\s*\(#\d+\)\s*$/, "")
    .trim()
    .toLowerCase();

/** A reverted reland: the original attempt failed (reverted), and so did the re-attempt. */
async function relands(repo: string, limit: number): Promise<number> {
  let n = 0;
  const pages = [1, 2, 3];
  const items: SearchItem[] = [];
  for (const page of pages)
    items.push(...(await search(`repo:${repo} is:pr is:merged in:title "Revert" "Reland"`, page)));
  for (const item of items.filter(isPr)) {
    if (n >= limit) break;
    if (!/^Revert\s+"?(Reland|Reapply|Recommit)/i.test(item.title)) continue;
    const m = REVERTS.exec(item.body ?? "");
    const relandNo = Number(m?.[1] ?? m?.[2] ?? m?.[3]);
    const reland = relandNo ? await pr(repo, relandNo) : null;
    if (!reland || !/^(Reland|Reapply|Recommit)/i.test(reland.title)) continue;
    const want = normTitle(normTitle(reland.title));
    if (want.length < 12) continue;
    const hits = (
      await search(`repo:${repo} is:pr is:merged in:title "${want.slice(0, 80).replace(/"/g, "")}"`)
    ).filter((h) => isPr(h) && h.number < relandNo && normTitle(h.title) === want);
    const original = hits.sort((a, b) => b.number - a.number)[0];
    if (!original) continue;
    emit({
      kind: "repeats_failure",
      repo,
      next: relandNo,
      other: original.number,
      evidence: item.title.slice(0, 160),
    });
    n += 1;
  }
  return n;
}

async function pool(repo: string): Promise<void> {
  for (const item of (await search(`repo:${repo} is:pr is:merged`)).filter(isPr).slice(0, 60))
    emit({ kind: "pool", repo, next: item.number, evidence: "" });
}

/** Files for every PR a candidate names (two calls' worth of budget per pair). */
async function fetchFiles(): Promise<void> {
  const rows = readFileSync(OUT, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Candidate);
  for (const c of rows) {
    if ((await ghRemaining()) < MIN_BUDGET) return;
    for (const n of [c.next, c.other]) {
      if (n === undefined) continue;
      await pr(c.repo, n);
      if (c.kind !== "pool") await prFiles(c.repo, n);
    }
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const perRepo = Number(flag(argv, "per-repo", "25"));
  // `--relands-only a/b,c/d`: a second, reland-only pass with a higher limit (search-light, core-heavy).
  const relandsOnly = flag(argv, "relands-only", "").split(",").filter(Boolean);
  mkdirSync(join(DATASETS, "github"), { recursive: true });
  if (existsSync(OUT))
    for (const l of readFileSync(OUT, "utf8").split("\n").filter(Boolean)) {
      const c = JSON.parse(l) as Candidate;
      seen.add(`${c.kind}|${c.repo}|${c.next}|${c.other ?? ""}`);
    }
  else writeFileSync(OUT, "");
  for (const repo of relandsOnly) {
    console.log(`${repo}: reland ${await relands(repo, perRepo)} · ${JSON.stringify(stats)}`);
  }
  for (const repo of relandsOnly.length ? [] : REPOS) {
    if ((await ghRemaining()) < MIN_BUDGET) break;
    const d = await duplicates(repo, perRepo);
    const o = await dependencies(repo, perRepo);
    const r = RELAND_REPOS.includes(repo) ? await relands(repo, perRepo) : 0;
    await pool(repo);
    console.log(`${repo}: duplicate ${d}, ordering ${o}, reland ${r} · ${JSON.stringify(stats)}`);
  }
  await fetchFiles();
  console.log(`done · ${JSON.stringify(stats)} · budget ${await ghRemaining()}`);
}

if (process.argv[1]?.endsWith("github-mine.ts"))
  main().catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  });
