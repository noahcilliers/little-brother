import { isAbsolute, relative, resolve } from "node:path";

/** Thrown for a path outside the agent's working directory; its message goes back to the model. */
export class OutsideCwd extends Error {}

/** Absolute path of `p` (relative to cwd, or absolute inside it). Anything that escapes cwd is refused. */
export function resolveInside(cwd: string, p: string): string {
  const abs = resolve(cwd, p);
  const rel = relative(cwd, abs);
  if (rel === ".." || rel.startsWith("../") || isAbsolute(rel))
    throw new OutsideCwd(`${p} is outside the working directory ${cwd}; use a path inside it.`);
  return abs;
}

/** Keeps the head and tail of long output: errors are usually at the end, context at the start. */
export function capText(text: string, max: number): string {
  if (text.length <= max) return text;
  const half = Math.floor(max / 2);
  return `${text.slice(0, half)}\n… [${text.length - max} characters cut] …\n${text.slice(-half)}`;
}
