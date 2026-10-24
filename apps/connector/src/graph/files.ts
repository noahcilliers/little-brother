import { spawnSync } from "node:child_process";
import { generatedMatcher, loadTopicMap } from "../normalize/topic-map";

const SOURCE = /\.(py|pyi|[cm]?[jt]sx?)$/;
const SKIPPED = [
  /(^|\/)(node_modules|vendor|vendored|third_party|site-packages|\.venv|venv|__pycache__|_generated|dist|build)\//,
  /\.d\.ts$/,
  /\.min\.js$/,
];
const MAX_FILES = 20_000;

/**
 * Source files the graph covers: tracked plus untracked-but-not-ignored, minus vendored and generated ones
 * (built-in list plus the repo's `.littlebrother.json` generated globs).
 */
export function sourceFiles(root: string): string[] {
  const r = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 20_000,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (r.status !== 0) return [];
  const generated = generatedMatcher(loadTopicMap(root).generated);
  const out: string[] = [];
  for (const f of new Set((r.stdout ?? "").split("\0"))) {
    if (!f || !SOURCE.test(f) || SKIPPED.some((re) => re.test(f)) || generated(f)) continue;
    out.push(f);
    if (out.length >= MAX_FILES) break;
  }
  return out;
}
