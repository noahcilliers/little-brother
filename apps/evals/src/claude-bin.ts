import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Orders "2.1.301" style versions numerically, so 2.1.310 beats 2.1.301 and 2.10.0 beats 2.9.9. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** The newest VS Code extension's bundled binary, for machines where `claude` isn't on PATH. */
function extensionBinary(): string | null {
  const root = join(homedir(), ".vscode", "extensions");
  if (!existsSync(root)) return null;
  const found = readdirSync(root)
    .map((d) => /^anthropic\.claude-code-(\d+(?:\.\d+)*)/.exec(d))
    .filter((m): m is RegExpExecArray => m !== null)
    .sort((a, b) => compareVersions(b[1] ?? "0", a[1] ?? "0"))
    .map((m) => join(root, m.input, "resources", "native-binary", "claude"))
    .find((p) => existsSync(p));
  return found ?? null;
}

let cached: string | null = null;

/** `$LB_EVAL_CLAUDE`, else `claude` on PATH, else the newest VS Code extension's binary. */
export function claudeBin(): string {
  if (cached) return cached;
  const fromEnv = process.env.LB_EVAL_CLAUDE;
  const onPath = spawnSync("sh", ["-c", "command -v claude"], { encoding: "utf8" }).stdout.trim();
  const pick = fromEnv || onPath || extensionBinary();
  if (!pick) throw new Error("no claude binary: set LB_EVAL_CLAUDE or put claude on PATH");
  cached = pick;
  return pick;
}
