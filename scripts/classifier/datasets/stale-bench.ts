import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type DiffFile, type LabelledPair, labelPair, pairMeta, parseUnifiedDiff, scoreCandidates } from "../../../packages/core/src/index";
import { DATASETS, flag, ghApi } from "./common";
import { PAIRS_DIR, prPair, tally, writeJsonl } from "./pr-pairs";

// STALE-bench (github.com/illinoisdata/STALE-bench) → pair JSONL. Coupled pairs merge cleanly but share a
// file; controls touch disjoint files. Labels (default --labels corrected):
//   corrected:   a pair is semantic_conflict only if the CORRECTED harness (results/real_corrected.jsonl)
//                measured delta_blind > 0; other coupled pairs are overlap_compatible; controls independent.
//   uncorrected: delta_blind > 0 in results/real_delta_blind.jsonl. The benchmark's README says that file is
//                inflated by a grading artifact (vacuous solo passes), so its positives are mostly not real.
// The 36 "real-derived" instances (a real Django helper renamed / re-signatured / re-typed while another task
// reuses it, interference measured 2/3–3/3) become semantic_conflict pairs built from their metadata.
//
//   npx tsx scripts/classifier/datasets/stale-bench.ts [--labels corrected|uncorrected]

const ROOT = join(DATASETS, "stale-bench");
const FETCHED = join(ROOT, "fetched");

type Instance = { id: string; repo: string; tier: string; base_commit: string; prs: number[]; per_pr?: Record<string, { code_files: string[] }> };
const GITHUB: Record<string, string> = { sympy: "sympy/sympy", xarray: "pydata/xarray", seaborn: "mwaskom/seaborn", requests: "psf/requests" };
type Result = { prs: number[]; delta_blind: number };
type Derived = { id: string; repo: string; symbol: string; mechanism: string; task_A: string; task_B: string; blind_interference_rate: string };

const jsonl = <T>(p: string): T[] =>
  readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);

async function prDiff(repo: string, pr: number): Promise<DiffFile[]> {
  const local = join(ROOT, "patches", repo.split("/")[1] ?? "", `pr${pr}`, "code.patch");
  if (existsSync(local)) return parseUnifiedDiff(readFileSync(local, "utf8"));
  const cached = join(FETCHED, `${repo.replace("/", "__")}__${pr}.diff`);
  if (!existsSync(cached)) {
    mkdirSync(FETCHED, { recursive: true });
    writeFileSync(cached, await ghApi(`repos/${repo}/pulls/${pr}`, "application/vnd.github.diff"));
  }
  return parseUnifiedDiff(readFileSync(cached, "utf8"));
}

const positives = (file: string): Set<string> =>
  new Set(jsonl<Result>(join(ROOT, "results", file)).filter((r) => r.delta_blind > 0).map((r) => r.prs.join("_")));

function derivedRow(d: Derived): LabelledPair | null {
  const parts = d.symbol.split(".");
  const name = parts.pop() ?? "helper";
  const path = `${parts.join("/")}.py`;
  const op = d.mechanism === "rename" ? "rename" : d.mechanism === "signature" ? "signature_change" : "write";
  const created = /`(\w+)\(/.exec(d.task_B)?.[1] ?? `${name}_new`;
  const other = { id: `${d.id}:A`, agentId: "A", kind: "action" as const, verb: "EDIT", text: `EDIT ${path} ${d.task_A}`, outcome: "open" as const, touches: [{ path, symbol: `${path}::${name}`, op }], references: [], at: 0 };
  const next = { id: `${d.id}:B`, agentId: "B", kind: "action" as const, verb: "EDIT", text: `EDIT ${path} add ${created}`, outcome: "open" as const, touches: [{ path, symbol: `${path}::${created}`, op: "create" as const }], references: [name], at: 3_600_000 };
  const [pair] = scoreCandidates(next, [{ node: other, failedMemory: false }]);
  if (!pair) return null;
  const interfered = Number(d.blind_interference_rate.split("/")[0]) > 0;
  return labelPair({
    id: `stale:${d.id}`,
    group: d.repo,
    pair,
    gold: { relation: interfered ? "semantic_conflict" : "overlap_compatible", origin: "dataset" },
    meta: { ...pairMeta(next, other), source: "stale-bench-derived", repo: d.repo, mechanism: d.mechanism },
  });
}

async function main(): Promise<void> {
  const labels = flag(process.argv.slice(2), "labels", "corrected");
  const measured = positives(labels === "uncorrected" ? "real_delta_blind.jsonl" : "real_corrected.jsonl");
  const instances = ["django", "sympy", "xarray", "seaborn", "requests", "control"].flatMap((f) => jsonl<Instance>(join(ROOT, "instances", `${f}.jsonl`)));
  const rows: LabelledPair[] = [];
  let skipped = 0;
  for (const raw of instances) {
    const inst = { ...raw, repo: GITHUB[raw.repo] ?? raw.repo };
    const [a, b] = inst.prs;
    if (a === undefined || b === undefined) continue;
    const only = (pr: number, fs: DiffFile[]) => {
      const listed = new Set(inst.per_pr?.[String(pr)]?.code_files ?? []);
      // Without a listed code-file set (non-Django repos), drop tests and docs the same way.
      return fs.filter((f) => (listed.size ? listed.has(f.path) : !/(^|\/)(tests?|docs?)\/|test_[^/]*\.py$/.test(f.path)));
    };
    const diffs = await Promise.all([prDiff(inst.repo, a), prDiff(inst.repo, b)]).catch(() => null);
    if (!diffs) {
      skipped += 1;
      continue;
    }
    const [fa, fb] = [only(a, diffs[0]), only(b, diffs[1])];
    const relation = inst.tier === "control" ? "independent" : measured.has(`${a}_${b}`) ? "semantic_conflict" : "overlap_compatible";
    const row = prPair(
      `stale:${inst.id}`,
      inst.repo,
      { id: `${inst.id}:${b}`, agentId: "B", files: fb, at: 3_600_000 },
      { id: `${inst.id}:${a}`, agentId: "A", files: fa, at: 0 },
      { relation, origin: "dataset" },
      { source: "stale-bench", repo: inst.repo, tier: inst.tier, labels },
    );
    if (row) rows.push(row);
    else skipped += 1;
  }
  for (const d of jsonl<Derived>(join(ROOT, "results", "realstale_batch.jsonl"))) {
    const row = derivedRow(d);
    if (row) rows.push(row);
  }
  const out = join(PAIRS_DIR, "stale-bench.jsonl");
  writeJsonl(out, rows);
  console.log(`stale-bench (${labels}): ${rows.length} pairs ${JSON.stringify(tally(rows))}, ${skipped} not retrieved by step 2 → ${out}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
