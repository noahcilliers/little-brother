import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { sh, shAsync, shOrThrow } from "../exec";

export const CACHE = join(homedir(), ".cache", "little-brother");

/** The oldest Python ≥ 3.12 available: Django main needs 3.12, and older is closer to the benchmarks' 3.11. */
export function findPython(): string {
  const candidates = [
    "python3.12",
    "python3.13",
    "/Library/Frameworks/Python.framework/Versions/3.13/bin/python3.13",
    "python3.14",
    "python3",
  ];
  for (const c of candidates) if (sh(c, ["--version"], homedir()).ok) return c;
  throw new Error("no python3 found");
}

/** A cached venv with `packages` installed; the package under test itself comes from PYTHONPATH. */
export function ensureVenv(name: string, packages: string[]): string {
  const dir = join(CACHE, "venvs", name);
  const python = join(dir, "bin", "python");
  if (existsSync(join(dir, ".ready"))) return dir;
  mkdirSync(join(CACHE, "venvs"), { recursive: true });
  if (!existsSync(python)) shOrThrow(findPython(), ["-m", "venv", dir], homedir());
  shOrThrow(python, ["-m", "pip", "install", "-q", "--upgrade", "pip"], homedir());
  if (packages.length) shOrThrow(python, ["-m", "pip", "install", "-q", ...packages], homedir());
  shOrThrow("touch", [join(dir, ".ready")], homedir());
  return dir;
}

/** What an agent or a grader needs to run the checkout at `pythonPath` with the venv's dependencies. */
export function pythonEnv(venv: string, pythonPath: string): Record<string, string> {
  return {
    PATH: `${join(venv, "bin")}:${process.env.PATH ?? "/usr/bin:/bin"}`,
    VIRTUAL_ENV: venv,
    PYTHONPATH: pythonPath,
    PYTHONDONTWRITEBYTECODE: "1",
  };
}

/** A command in the venv with a timeout; the output is kept whole for parsing. */
export function runIn(venv: string, pythonPath: string, cwd: string, command: string, timeoutMs: number) {
  const env = pythonEnv(venv, pythonPath);
  const prefix = Object.entries(env)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(" ");
  return shAsync(`env ${prefix} ${command}`, cwd, timeoutMs);
}
