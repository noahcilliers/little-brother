import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import picomatch from "picomatch";
import { resolveInside } from "./paths";
import type { ToolOutcome } from "./types";

const MAX_FILES = 20_000;
const MAX_RESULTS = 200;
const MAX_GREP_BYTES = 1_000_000;
const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".next", "__pycache__", ".venv"]);

function walk(root: string, dir: string, out: string[]): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (out.length >= MAX_FILES) return;
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(root, join(dir, e.name), out);
    } else if (e.isFile()) out.push(relative(root, join(dir, e.name)));
  }
}

/** Files under cwd, git-ignored ones left out (git ls-files when it's a repo, a plain walk otherwise). */
export function listFiles(cwd: string): string[] {
  try {
    const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\0").filter(Boolean).slice(0, MAX_FILES);
  } catch {
    const out: string[] = [];
    walk(cwd, cwd, out);
    return out;
  }
}

const matcher = (pattern: string) => picomatch(pattern, { dot: true, basename: !pattern.includes("/") });

export function globTool(cwd: string, input: Record<string, unknown>): ToolOutcome {
  const pattern = String(input.pattern ?? "");
  const isMatch = matcher(pattern);
  const hits = listFiles(cwd).filter((f) => isMatch(f));
  const shown = hits.slice(0, MAX_RESULTS);
  const more = hits.length > shown.length ? `\n… ${hits.length - shown.length} more` : "";
  return {
    ok: true,
    text: shown.length ? shown.join("\n") + more : `No files match ${pattern}`,
    response: { filenames: shown, numFiles: hits.length, truncated: hits.length > shown.length },
  };
}

function scope(cwd: string, path: string | undefined): (f: string) => boolean {
  if (!path) return () => true;
  const rel = relative(cwd, resolveInside(cwd, path));
  if (!rel) return () => true;
  return (f) => f === rel || f.startsWith(`${rel}/`);
}

export function grepTool(cwd: string, input: Record<string, unknown>): ToolOutcome {
  let re: RegExp;
  try {
    re = new RegExp(String(input.pattern ?? ""));
  } catch (e) {
    const text = `Invalid regular expression: ${e instanceof Error ? e.message : String(e)}`;
    return { ok: false, text, response: { error: text } };
  }
  const inScope = scope(cwd, typeof input.path === "string" ? input.path : undefined);
  const globOk = typeof input.glob === "string" && input.glob ? matcher(input.glob) : () => true;
  const lines: string[] = [];
  const files = new Set<string>();
  for (const f of listFiles(cwd)) {
    if (lines.length >= MAX_RESULTS) break;
    if (!inScope(f) || !globOk(f)) continue;
    let text: string;
    try {
      const abs = join(cwd, f);
      if (statSync(abs).size > MAX_GREP_BYTES) continue;
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\0")) continue;
    text.split("\n").forEach((line, i) => {
      if (lines.length < MAX_RESULTS && re.test(line)) {
        lines.push(`${f}:${i + 1}: ${line.trim().slice(0, 300)}`);
        files.add(f);
      }
    });
  }
  const capped =
    lines.length >= MAX_RESULTS ? `\n… stopped at ${MAX_RESULTS} matches; narrow the search` : "";
  return {
    ok: true,
    text: lines.length ? lines.join("\n") + capped : `No matches for ${String(input.pattern)}`,
    response: { mode: "content", numFiles: files.size, filenames: [...files], numLines: lines.length },
  };
}
