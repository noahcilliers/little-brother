import { lexShell, type ShellToken, type ShellWord } from "./shell-lex";

/**
 * A file a Bash command writes through a redirect or `tee`. `path` is as typed, joined onto any literal
 * `cd` before it; `content` is set only when the text is known without running anything (a heredoc or
 * here-string fed through `cat`/`tee`, or a plain `echo`).
 */
export type ShellWrite = { path: string; append: boolean; content?: string };

type Redirect = { op: string; fd?: number; target?: ShellWord };
type SimpleCommand = { words: ShellWord[]; redirects: Redirect[]; stdin?: string; pipesOut: boolean };

const SEPARATORS = new Set([";", "&&", "||", "|", "|&", "&", "\n", "(", ")", ";;"]);
const STDOUT_OPS = new Set([">", ">>", ">|", "&>", "&>>"]);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

function commands(tokens: ShellToken[]): SimpleCommand[] {
  const out: SimpleCommand[] = [];
  let cur: SimpleCommand = { words: [], redirects: [], pipesOut: false };
  const flush = (pipesOut: boolean) => {
    if (cur.words.length || cur.redirects.length || cur.stdin !== undefined) out.push({ ...cur, pipesOut });
    cur = { words: [], redirects: [], pipesOut: false };
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) continue;
    if (t.kind === "op") {
      if (SEPARATORS.has(t.text)) flush(t.text === "|" || t.text === "|&");
    } else if (t.kind === "heredoc") cur.stdin = t.body;
    else if (t.kind === "redirect") {
      const next = tokens[i + 1];
      const target = next?.kind === "word" ? next : undefined;
      if (target) i++;
      if (t.op === "<<<" && target) cur.stdin = `${target.text}\n`;
      else cur.redirects.push({ op: t.op, fd: t.fd, target });
    } else cur.words.push(t);
  }
  flush(false);
  return out;
}

/** What a command prints, when that is knowable from the command text alone. */
function stdoutOf(name: string, args: ShellWord[], stdin: string | undefined): string | undefined {
  if (name === "cat" && args.every((a) => a.text === "-")) return stdin;
  if (name === "tee") return stdin;
  if (name !== "echo" || !args.every((a) => a.literal)) return undefined;
  const flags = args.findIndex((a) => !/^-[neE]+$/.test(a.text));
  const opts = (flags < 0 ? args : args.slice(0, flags)).map((a) => a.text).join("");
  if (opts.includes("e")) return undefined;
  const text = (flags < 0 ? [] : args.slice(flags)).map((a) => a.text).join(" ");
  return opts.includes("n") ? text : `${text}\n`;
}

const isFile = (w: ShellWord | undefined): w is ShellWord =>
  !!w && w.literal && w.text !== "" && !w.text.startsWith("/dev/") && !w.text.startsWith("&");

function joinDir(dir: string, path: string): string {
  if (path.startsWith("/") || dir === "") return path;
  return `${dir.replace(/\/+$/, "")}/${path}`;
}

/** Files written by redirects (`>`, `>>`, `&>`) and `tee` in a Bash command. Never throws. */
export function shellWrites(command: string): ShellWrite[] {
  let cmds: SimpleCommand[];
  try {
    cmds = commands(lexShell(command));
  } catch {
    return [];
  }
  const writes: ShellWrite[] = [];
  // "" = the hook's cwd; null = a `cd` we cannot follow, so relative paths after it are unknown.
  let dir: string | null = "";
  let piped: string | undefined;
  for (const c of cmds) {
    // `FOO=1 cat > f` runs cat; leading assignments are not the command.
    const first = c.words.findIndex((w) => !ASSIGNMENT.test(w.text));
    const [head, ...args] = first < 0 ? [] : c.words.slice(first);
    const name = head?.text ?? "";
    const stdin = c.stdin ?? piped;
    const push = (target: ShellWord, append: boolean, content: string | undefined) => {
      if (dir === null && !target.text.startsWith("/")) return;
      const w: ShellWrite = { path: joinDir(dir ?? "", target.text), append };
      if (content !== undefined) w.content = content;
      writes.push(w);
    };
    const out = stdoutOf(name, args, stdin);
    let redirected = false;
    for (const r of c.redirects) {
      if (!STDOUT_OPS.has(r.op) || (r.fd !== undefined && r.fd !== 1)) continue;
      redirected = true;
      if (isFile(r.target)) push(r.target, r.op.endsWith(">>"), out);
    }
    if (name === "tee") {
      const append = args.some((a) => a.text === "-a" || a.text === "--append");
      for (const a of args) if (!a.text.startsWith("-") && isFile(a)) push(a, append, stdin);
    }
    if (name === "cd") {
      const to = args[0];
      const followable: boolean =
        !!to && to.literal && to.text !== "-" && (dir !== null || to.text.startsWith("/"));
      dir = followable && to ? joinDir(dir ?? "", to.text) : null;
    }
    piped = c.pipesOut && !redirected ? out : undefined;
  }
  return writes;
}
