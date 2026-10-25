import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CASES } from "../cases";
import type { RunRecord } from "./aggregate";
import { armOf } from "./arm";
import { removeWorkspace, restoreTree } from "./cleanup";
import { checkSuccess } from "./fixup";
import { ROOT } from "./setup";
import { linkModules, prepareModules } from "./workspace";

/** Where a run's fix-up tree lives: next to its merged tree, which run.json records. */
function fixupDir(runJson: string): string | null {
  const run = JSON.parse(readFileSync(runJson, "utf8")) as { merged?: { dir?: string } };
  const merged = run.merged?.dir;
  return merged ? join(dirname(merged), "fixup") : null;
}

const runName = (r: RunRecord) =>
  armOf(r) === "on" ? `${r.caseId}-${r.variant}-${r.run}` : `${r.caseId}-${r.variant}-off-${r.run}`;

/**
 * Re-grades the fix-up trees of an earlier results directory against the cases' current success criteria,
 * without rerunning any agent: for when a criterion turned out too strict (a name only the pointed prompt
 * gives). Rewrites `finalSuccess` in runs.json and returns the records.
 */
export async function recheck(outDir: string): Promise<RunRecord[]> {
  const file = join(outDir, "runs.json");
  const runs = JSON.parse(readFileSync(file, "utf8")) as RunRecord[];
  let changed = 0;
  for (const r of runs) {
    if (r.error || r.finalSuccess === undefined) continue;
    const c = CASES.find((x) => x.id === r.caseId);
    const runJson = join(outDir, "runs", runName(r), "run.json");
    const archive = join(outDir, "runs", runName(r), "fixup.tar");
    let dir = existsSync(runJson) ? fixupDir(runJson) : null;
    let restored: string | null = null;
    if (existsSync(archive) && (!dir || !existsSync(dir))) {
      restored = mkdtempSync(join(tmpdir(), "lb-recheck-"));
      if (!restoreTree(archive, restored)) continue;
      linkModules(prepareModules(join(ROOT, "demo/shop"), join(ROOT, "apps/evals/results/.cache")), restored);
      dir = restored;
    }
    if (!c || !dir || !existsSync(dir)) continue;
    const { success, checks } = await checkSuccess(dir, c.success);
    if (restored) removeWorkspace(restored);
    if (success !== r.finalSuccess) changed++;
    r.finalSuccess = success;
    const full = JSON.parse(readFileSync(runJson, "utf8")) as Record<string, unknown>;
    writeFileSync(runJson, JSON.stringify({ ...full, finalSuccess: success, recheck: checks }, null, 2));
  }
  writeFileSync(file, JSON.stringify(runs, null, 2));
  console.log(`rechecked ${runs.length} run(s) in ${outDir}: ${changed} changed`);
  return runs;
}
