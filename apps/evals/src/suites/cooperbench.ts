import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sh } from "../exec";
import { branchOf } from "../workspace";
import { applyPatch, checkoutAt, mergedTree, patchFiles, resetPaths } from "./grade-tree";
import { type GradeInput, type PairGrade, type PairTask, PYTHON_TOOLS } from "./pair-task";
import { CACHE, ensureVenv, pythonEnv, runIn } from "./python-env";

// CooperBench (arXiv 2601.13295): one real PR split into features, each with a description and hidden tests.
// Their runner needs Modal or Docker plus Redis and can't host Claude Code with our plugin, so this uses
// their dataset and tests with our runner. Scoring is theirs, strict: a clean merge and every feature's
// tests passing on the merged code.

export const COOPER_DIR = join(CACHE, "benchmarks", "CooperBench", "dataset");

type RepoSpec = {
  /** Clone under ~/.cache/little-brother/repos. */
  clone: string;
  /** Subdirectory that goes on PYTHONPATH (src layout or not). */
  importRoot: string;
  /** Runtime dependencies; the package itself comes from the agent's checkout. */
  deps: string[];
};

const REPOS: Record<string, RepoSpec> = {
  pallets_jinja_task: { clone: "jinja", importRoot: "src", deps: ["MarkupSafe>=2.0"] },
  pallets_click_task: { clone: "click", importRoot: "src", deps: [] },
  samuelcolvin_dirty_equals_task: { clone: "dirty-equals", importRoot: ".", deps: ["pytz"] },
};

const TEST_DEPS = ["pytest", "pytest-xdist", "pytest_mock"];

/** Pilot defaults: pairs where a model passed alone and failed as a pair in the paper, plus one easy pair. */
export const COOPER_DEFAULT = [
  "pallets_jinja_task/1621/5+8",
  "pallets_click_task/2800/2+6",
  "samuelcolvin_dirty_equals_task/43/1+2",
  "pallets_jinja_task/1621/2+10",
  "pallets_jinja_task/1559/6+10",
];

const HANDLES = ["leo", "priya"] as const;

type Feature = { n: number; prompt: string; testsPatch: string; testFiles: string[] };

function feature(taskDir: string, n: number): Feature {
  const dir = join(taskDir, `feature${n}`);
  const testsPatch = join(dir, "tests.patch");
  return {
    n,
    prompt: readFileSync(join(dir, "feature.md"), "utf8").trim(),
    testsPatch,
    testFiles: patchFiles(readFileSync(testsPatch, "utf8")),
  };
}

const baseCommit = (taskDir: string): string => {
  const sha = /git checkout ([0-9a-f]{40})/.exec(readFileSync(join(taskDir, "Dockerfile"), "utf8"))?.[1];
  if (!sha) throw new Error(`no base commit in ${taskDir}/Dockerfile`);
  return sha;
};

async function pytest(venv: string, dir: string, importRoot: string, files: string[], deselect: string[]) {
  const skip = deselect.map((id) => `--deselect ${JSON.stringify(id)}`).join(" ");
  const r = await runIn(
    venv,
    join(dir, importRoot),
    dir,
    `python -m pytest -q -rfE -p no:cacheprovider ${skip} ${files.join(" ")}`,
    10 * 60_000,
  );
  return { ok: r.ok, out: r.out, tail: r.out.trim().split("\n").slice(-2).join(" ⏎ ").slice(0, 300) };
}

/** Node ids in pytest's short summary (`FAILED tests/x.py::name - reason`). */
export const failedIds = (out: string): string[] =>
  [...out.matchAll(/^(?:FAILED|ERROR) (\S+)/gm)].map((m) => m[1] ?? "").filter((id) => id.includes("::"));

/**
 * Tests that already fail on the untouched base in this Python (jinja's zip-loader test breaks on 3.13; the
 * benchmark pins 3.11). They're deselected everywhere so the environment can't fail a pair.
 */
async function failingOnBase(g: GradeInput, fs: Feature[], venv: string, repo: RepoSpec): Promise<string[]> {
  const dir = checkoutAt(g.repo, join(g.dir, "base"), g.base);
  const files = [...new Set(fs.flatMap((f) => f.testFiles))];
  return failedIds((await pytest(venv, dir, repo.importRoot, files, [])).out);
}

/** Applies one feature's hidden tests over a clean copy of the tree (agent edits to those files dropped). */
async function featurePasses(
  dir: string,
  base: string,
  f: Feature,
  venv: string,
  importRoot: string,
  deselect: string[],
) {
  sh("git", ["checkout", "--", "."], dir);
  sh("git", ["clean", "-fdq"], dir);
  resetPaths(dir, base, f.testFiles);
  if (!applyPatch(dir, f.testsPatch)) return { ok: false, tail: "tests.patch did not apply" };
  return pytest(venv, dir, importRoot, f.testFiles, deselect);
}

async function grade(g: GradeInput, fs: Feature[], venv: string, repo: RepoSpec): Promise<PairGrade> {
  mkdirSync(g.dir, { recursive: true });
  const deselect = await failingOnBase(g, fs, venv, repo);
  const solved: Record<string, boolean> = {};
  const detail: Record<string, unknown> = { deselected: deselect };
  for (const [i, h] of g.handles.entries()) {
    const f = fs[i];
    if (!f) continue;
    const dir = checkoutAt(g.repo, join(g.dir, h), branchOf(h));
    const r = await featurePasses(dir, g.base, f, venv, repo.importRoot, deselect);
    solved[h] = r.ok;
    detail[`solo-${f.n}`] = r.tail;
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
  const results: boolean[] = [];
  for (const f of fs) {
    const r = await featurePasses(merged.dir, g.base, f, venv, repo.importRoot, deselect);
    results.push(r.ok);
    detail[`merged-${f.n}`] = r.tail;
  }
  // Features that passed with their own branch alone and fail merged: CooperBench's coordination failures.
  const broken = fs.filter((_, i) => solved[g.handles[i] ?? ""] && !results[i]).length;
  return {
    mergeConflict: false,
    success: results.every(Boolean),
    interference: broken,
    solved,
    clash: broken > 0,
    detail,
  };
}

/** Task ids are `<repo_task>/<task id>/<feature a>+<feature b>`. */
export function cooperTasks(ids: string[]): PairTask[] {
  if (!existsSync(COOPER_DIR))
    throw new Error(`clone https://github.com/cooperbench/CooperBench under ${COOPER_DIR}/..`);
  return (ids.length ? ids : COOPER_DEFAULT).map((id) => {
    const m = /^([a-z_]+)\/(\d+)\/(\d+)\+(\d+)$/.exec(id);
    const repo = m?.[1] ? REPOS[m[1]] : undefined;
    if (!m || !repo)
      throw new Error(`bad CooperBench task id ${id} (want repo_task/<id>/<a>+<b>, known repos only)`);
    const taskDir = join(COOPER_DIR, m[1] ?? "", `task${m[2]}`);
    const fs = [Number(m[3]), Number(m[4])].map((n) => feature(taskDir, n));
    const venv = ensureVenv(`cooper-${repo.clone}`, [...repo.deps, ...TEST_DEPS]);
    const testFiles = [...new Set(fs.flatMap((f) => f.testFiles))];
    const note = `Python: \`python\` has the dependencies and imports this checkout. Run tests with \`python -m pytest ${testFiles.join(" ")}\`. Don't install packages.`;
    return {
      suite: "cooper" as const,
      id,
      kind: "cooper",
      repoCache: join(CACHE, "repos", repo.clone),
      base: baseCommit(taskDir),
      expectClash: true,
      agents: fs.map((f, i) => ({
        handle: HANDLES[i] ?? `agent${i}`,
        prompt: `Implement this feature in the repository.\n\n${f.prompt}\n\n${note}`,
      })),
      env: (cwd: string) => pythonEnv(venv, join(cwd, repo.importRoot)),
      extraTools: PYTHON_TOOLS,
      grade: (g) => grade(g, fs, venv, repo),
    };
  });
}
