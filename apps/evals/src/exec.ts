import { spawn, spawnSync } from "node:child_process";

export type Ran = { ok: boolean; code: number | null; out: string };

/** Synchronous command for short git/setup steps; never throws. */
export function sh(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): Ran {
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

export function shOrThrow(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): string {
  const r = sh(cmd, args, cwd, env);
  if (!r.ok) throw new Error(`${cmd} ${args.join(" ")} (in ${cwd}) failed: ${r.out.trim().slice(-800)}`);
  return r.out;
}

/** Async shell command with a timeout, for checks that run test suites. */
export function shAsync(command: string, cwd: string, timeoutMs: number): Promise<Ran> {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-c", command], { cwd, env: process.env });
    let out = "";
    child.stdout.on("data", (d) => {
      out += String(d);
    });
    child.stderr.on("data", (d) => {
      out += String(d);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, out });
    });
  });
}
