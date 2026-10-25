import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sessionDir } from "../hook/session-file";
import { type FileChange, fileChange } from "./file-change";

// Agents (Claude Code's auto mode especially) edit through Bash: inline Python, `sed -i`, heredocs, scripts.
// Parsing the command can't see those writes, so PreToolUse snapshots the working tree's dirty files and
// PostToolUse diffs against it: whatever the command changed becomes Edit-like touches, symbols included.

const GIT_TIMEOUT_MS = 1500;
const MAX_DIRTY = 400;
const MAX_KEPT_BYTES = 200_000;
const MAX_CHANGED = 15;

type Snapshot = { hashes: Record<string, string>; texts: Record<string, string> };

const git = (root: string, args: string[], input?: string): string =>
  execFileSync("git", args, {
    cwd: root,
    input,
    encoding: "utf8",
    timeout: GIT_TIMEOUT_MS,
    stdio: ["pipe", "pipe", "ignore"],
  });

/** Paths with uncommitted changes (tracked or untracked, not ignored), repo-relative. */
function dirtyPaths(root: string): string[] {
  const out = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const paths: string[] = [];
  const parts = out.split("\0");
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i] ?? "";
    if (entry.length < 4) continue;
    paths.push(entry.slice(3));
    if (entry[0] === "R" || entry[0] === "C") i++; // renames carry the old path as the next field
  }
  return paths.slice(0, MAX_DIRTY);
}

function hashes(root: string, paths: string[]): Record<string, string> {
  const present = paths.filter((p) => existsSync(join(root, p)));
  const out: Record<string, string> = Object.fromEntries(paths.map((p) => [p, "deleted"]));
  if (present.length === 0) return out;
  const lines = git(root, ["hash-object", "--stdin-paths"], `${present.join("\n")}\n`)
    .trim()
    .split("\n");
  present.forEach((p, i) => {
    out[p] = lines[i] ?? "";
  });
  return out;
}

const fileFor = (key: string) => join(sessionDir(), "bash", `${key.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);

function readText(root: string, rel: string): string | null {
  try {
    const abs = join(root, rel);
    return existsSync(abs) ? readFileSync(abs, "utf8") : null;
  } catch {
    return null;
  }
}

function headText(root: string, rel: string): string | null {
  try {
    return git(root, ["show", `HEAD:${rel}`]);
  } catch {
    return null;
  }
}

/** PreToolUse(Bash): remember what is dirty now, with the text of small dirty files for the later diff. */
export function snapshotBefore(root: string, key: string): void {
  try {
    const paths = dirtyPaths(root);
    const texts: Record<string, string> = {};
    for (const p of paths) {
      const t = readText(root, p);
      if (t !== null && t.length <= MAX_KEPT_BYTES) texts[p] = t;
    }
    const snap: Snapshot = { hashes: hashes(root, paths), texts };
    mkdirSync(join(sessionDir(), "bash"), { recursive: true });
    writeFileSync(fileFor(key), JSON.stringify(snap));
  } catch {
    // no snapshot: PostToolUse falls back to what the command text shows
  }
}

/** PostToolUse(Bash): files the command changed, as Edit-like touches against their pre-command text. */
export async function changesSince(
  root: string,
  key: string,
): Promise<(FileChange & { files: string[] }) | null> {
  let snap: Snapshot;
  try {
    snap = JSON.parse(readFileSync(fileFor(key), "utf8")) as Snapshot;
    rmSync(fileFor(key), { force: true });
  } catch {
    return null;
  }
  try {
    const now = hashes(root, dirtyPaths(root));
    const changed = [
      ...Object.keys(now).filter((p) => snap.hashes[p] !== now[p]),
      ...Object.keys(snap.hashes).filter((p) => !(p in now)),
    ].slice(0, MAX_CHANGED);
    const out = { files: [] as string[], touches: [] as FileChange["touches"], references: [] as string[] };
    for (const rel of changed) {
      const before = rel in snap.texts ? (snap.texts[rel] ?? null) : headText(root, rel);
      const after = readText(root, rel);
      if (after === null && before === null) continue;
      const change = await fileChange(rel, before, after ?? "", before === null, root);
      out.files.push(rel);
      out.touches.push(...change.touches);
      for (const r of change.references) if (!out.references.includes(r)) out.references.push(r);
    }
    return out;
  } catch {
    return null;
  }
}
