import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchOf } from "../workspace";
import { applyPatch, checkoutAt, mergedTree, resetPaths } from "./grade-tree";
import type { GradeInput, PairGrade } from "./pair-task";
import { runIn } from "./python-env";
import { type HelperSpec, type Mechanism, mechanismProbe, oracleAssert, pythonCheck } from "./stale-specs";
import { interference, namePasses, parseUnittest, type TestStatus } from "./unittest-output";

const TEST_TIMEOUT_MS = 10 * 60_000;

async function runtests(venv: string, dir: string, labels: string[]) {
  const r = await runIn(
    venv,
    dir,
    dir,
    `python tests/runtests.py --parallel 1 --noinput -v 2 ${labels.join(" ")}`,
    TEST_TIMEOUT_MS,
  );
  return { ok: r.ok, status: parseUnittest(r.out), tail: r.out.trim().split("\n").slice(-4).join(" ⏎ ") };
}

async function pythonOk(venv: string, dir: string, script: string): Promise<{ ok: boolean; err: string }> {
  const file = join(dir, ".lb-eval-check.py");
  writeFileSync(file, script);
  const r = await runIn(venv, dir, dir, `python ${JSON.stringify(file)}`, 120_000);
  return { ok: r.ok, err: r.ok ? "" : r.out.trim().split("\n").slice(-1).join("").slice(0, 300) };
}

export type RealPair = {
  prs: { pr: number; testPatch: string; labels: string[]; failToPass: string[] }[];
};

/**
 * A mined pair with the corrected harness: agent test edits discarded, both PRs' gold tests applied in every
 * condition (each branch alone, and merged), and the union of both PRs' labels run each time.
 */
export async function gradeRealPair(g: GradeInput, venv: string, pair: RealPair): Promise<PairGrade> {
  mkdirSync(g.dir, { recursive: true });
  const labels = [...new Set(pair.prs.flatMap((p) => p.labels))];
  const prepare = (dir: string) => {
    resetPaths(dir, g.base, ["tests"]);
    return pair.prs.every((p) => applyPatch(dir, p.testPatch));
  };
  const solo: { status: Map<string, TestStatus>; owns: string[] }[] = [];
  const solved: Record<string, boolean> = {};
  const detail: Record<string, unknown> = {};
  for (const [i, h] of g.handles.entries()) {
    const pr = pair.prs[i];
    if (!pr) continue;
    const dir = checkoutAt(g.repo, join(g.dir, h), branchOf(h));
    const applied = prepare(dir);
    const r = await runtests(venv, dir, labels);
    solo.push({ status: r.status, owns: pr.failToPass });
    solved[h] = applied && pr.failToPass.every((t) => namePasses(r.status, t));
    detail[h] = { applied, tail: r.tail, tests: r.status.size };
  }
  const merged = mergedTree(g.repo, join(g.dir, "merged"), g.base, g.handles);
  if (merged.conflict.length)
    return {
      mergeConflict: true,
      success: false,
      interference: null,
      solved,
      clash: true,
      detail: { ...detail, conflict: merged.conflict },
    };
  const applied = prepare(merged.dir);
  const m = await runtests(venv, merged.dir, labels);
  const inter = interference(solo, m.status);
  const allF2p = pair.prs.flatMap((p) => p.failToPass);
  const success = applied && allF2p.every((t) => namePasses(m.status, t));
  return {
    mergeConflict: false,
    success,
    interference: inter.count,
    solved,
    clash: inter.count > 0,
    detail: { ...detail, merged: { applied, tail: m.tail, interfering: inter.tests.slice(0, 20) } },
  };
}

export type Constructed = {
  helper: HelperSpec;
  mechanism: Mechanism;
  oracle: string;
};

/**
 * The real-derived tier: A changes a helper's interface, B reuses the helper. B's oracle and A's module
 * tests are graded on each branch and on the merge; interference counts each that passed alone and fails
 * merged, as the paper's per-run `interference` flag does for the oracle.
 */
export async function gradeConstructed(g: GradeInput, venv: string, c: Constructed): Promise<PairGrade> {
  mkdirSync(g.dir, { recursive: true });
  const [a, b] = g.handles;
  if (!a || !b) throw new Error("constructed pairs need two agents");
  const oracle = pythonCheck(c.helper.module, oracleAssert(c.oracle));
  const probe = pythonCheck(c.helper.module, mechanismProbe(c.helper, c.mechanism));
  const aDir = checkoutAt(g.repo, join(g.dir, a), branchOf(a));
  const bDir = checkoutAt(g.repo, join(g.dir, b), branchOf(b));
  const aSuite = await runtests(venv, aDir, [c.helper.label]);
  const aProbe = await pythonOk(venv, aDir, probe);
  const bOracle = await pythonOk(venv, bDir, oracle);
  const solved = { [a]: aSuite.ok && aProbe.ok, [b]: bOracle.ok };
  const detail: Record<string, unknown> = {
    aSuite: aSuite.ok,
    aSuiteTail: aSuite.tail,
    aProbe: aProbe.ok,
    bOracle: bOracle.ok,
    bOracleErr: bOracle.err,
  };
  const merged = mergedTree(g.repo, join(g.dir, "merged"), g.base, g.handles);
  if (merged.conflict.length)
    return {
      mergeConflict: true,
      success: false,
      interference: null,
      solved,
      clash: true,
      detail: { ...detail, conflict: merged.conflict },
    };
  const mSuite = await runtests(venv, merged.dir, [c.helper.label]);
  const mOracle = await pythonOk(venv, merged.dir, oracle);
  const mProbe = await pythonOk(venv, merged.dir, probe);
  const count = Number(bOracle.ok && !mOracle.ok) + Number(aSuite.ok && !mSuite.ok);
  return {
    mergeConflict: false,
    success: mSuite.ok && mOracle.ok && mProbe.ok,
    interference: count,
    solved,
    clash: count > 0,
    detail: {
      ...detail,
      mergedSuite: mSuite.ok,
      mergedSuiteTail: mSuite.tail,
      mergedOracle: mOracle.ok,
      mergedOracleErr: mOracle.err,
      mergedProbe: mProbe.ok,
    },
  };
}
