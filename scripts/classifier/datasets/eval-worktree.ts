import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type DiffFile, parseUnifiedDiff } from "../../../packages/core/src/index";
import { DATASETS } from "./common";

// Each eval run leaves its git worktrees under /tmp/lb-evals/<tag>/<run>/, one branch `<handle>/work` per
// agent with everything it wrote committed. Their diffs against the shared merge base are real agent edits.

const ROOT = "/private/tmp/lb-evals";

/** Tags are UTC MMDDHHMMSS of the invocation's start (see apps/evals cli.ts). */
function tagTime(tag: string, year: number): number {
  const n = (i: number) => Number(tag.slice(i, i + 2));
  return Date.UTC(year, n(0) - 1, n(2), n(4), n(6), n(8));
}

/** The worktree directory for a run: the latest invocation that started before the run did. */
export function worktreeDir(relRun: string, startedAt: number): string | null {
  if (!existsSync(ROOT)) return null;
  const year = new Date(startedAt).getUTCFullYear();
  const tags = readdirSync(ROOT)
    .filter((t) => /^\d{10}$/.test(t) && existsSync(join(ROOT, t, relRun)))
    .filter((t) => tagTime(t, year) <= startedAt)
    .sort((a, b) => tagTime(b, year) - tagTime(a, year));
  return tags[0] ? join(ROOT, tags[0], relRun) : null;
}

const git = (dir: string, args: string[]): string | null => {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
  } catch {
    return null;
  }
};

const SAVED = join(DATASETS, "eval-diffs");
const savedPath = (relRun: string) => join(SAVED, `${relRun.replace(/[^\w.+-]+/g, "_")}.json`);

/** Diffs saved by an earlier conversion: worktrees under /tmp are cleaned up as the harness moves on. */
export function savedDiffs(relRun: string): { a: string; b: string } | null {
  const f = savedPath(relRun);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as { a: string; b: string }) : null;
}

/** A run's two diffs: from its worktree when it still exists (and saved for next time), else the saved copy. */
export function runDiffs(
  relRun: string,
  startedAt: number,
  a: string,
  b: string,
): { a: DiffFile[]; b: DiffFile[] } | null {
  const ws = Number.isFinite(startedAt) ? worktreeDir(relRun, startedAt) : null;
  const raw = (ws ? rawDiffs(ws, a, b) : null) ?? savedDiffs(relRun);
  if (!raw) return null;
  if (ws) {
    mkdirSync(SAVED, { recursive: true });
    writeFileSync(savedPath(relRun), JSON.stringify(raw));
  }
  return { a: parseUnifiedDiff(raw.a), b: parseUnifiedDiff(raw.b) };
}

/** Each agent's committed work since the two branches' merge base, as diff text. */
function rawDiffs(ws: string, a: string, b: string): { a: string; b: string } | null {
  const dir = [a, b].map((h) => join(ws, h)).find((d) => existsSync(d));
  if (!dir) return null;
  const base = git(dir, ["merge-base", `${a}/work`, `${b}/work`])?.trim();
  if (!base) return null;
  const diff = (h: string) => git(dir, ["diff", base, `${h}/work`]);
  const [da, db] = [diff(a), diff(b)];
  if (da === null || db === null) return null;
  return { a: da, b: db };
}
