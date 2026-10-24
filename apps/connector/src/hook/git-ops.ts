import { posix } from "node:path";
import type { GitOp } from "@lb/core";

export type GitOpKind = GitOp["op"];

/** One git invocation found in a shell command; `dir` is the effective directory, relative to the hook cwd. */
export type ParsedGitOp = { op: GitOpKind; args: string[]; dir: string };

const SUBCOMMANDS: Record<string, GitOpKind> = {
  commit: "commit",
  push: "push",
  merge: "merge",
  rebase: "rebase",
  checkout: "checkout",
  switch: "checkout",
  pull: "pull",
};

/** Which op a chained command reports: the one that moves work furthest toward the shared branch. */
const WEIGHT: Record<GitOpKind, number> = { checkout: 0, commit: 1, rebase: 2, pull: 3, merge: 4, push: 5 };

/** Splits on && || ; | and newlines, keeping quoted text intact. */
function segments(command: string): string[][] {
  const out: string[][] = [];
  let words: string[] = [];
  let word = "";
  let inWord = false;
  let quote: '"' | "'" | null = null;
  const endWord = () => {
    if (inWord) words.push(word);
    word = "";
    inWord = false;
  };
  const endSegment = () => {
    endWord();
    if (words.length) out.push(words);
    words = [];
  };
  for (let i = 0; i < command.length; i++) {
    const ch = command[i] ?? "";
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < command.length) word += command[++i];
      else word += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      inWord = true;
    } else if (ch === "\\" && i + 1 < command.length) {
      word += command[++i];
      inWord = true;
    } else if (ch === "&" || ch === "|" || ch === ";" || ch === "\n" || ch === "(" || ch === ")") {
      endSegment();
    } else if (ch === " " || ch === "\t") {
      endWord();
    } else {
      word += ch;
      inWord = true;
    }
  }
  endSegment();
  return out;
}

const isAssignment = (w: string) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(w);

function parseGit(words: string[], dir: string): ParsedGitOp | null {
  let i = 0;
  while (i < words.length && isAssignment(words[i] ?? "")) i++;
  if (words[i] !== "git") return null;
  i++;
  let cwd = dir;
  while (i < words.length) {
    const w = words[i] ?? "";
    if (w === "-C") {
      const d = words[i + 1] ?? ".";
      cwd = d.startsWith("/") ? d : posix.join(cwd, d);
      i += 2;
    } else if (w === "-c" || w === "--git-dir" || w === "--work-tree" || w === "--namespace") {
      i += 2;
    } else if (w.startsWith("-")) {
      i++;
    } else break;
  }
  const op = SUBCOMMANDS[words[i] ?? ""];
  return op ? { op, args: words.slice(i + 1), dir: cwd } : null;
}

/** Every git operation we track in a shell command, in order. `cd` segments carry into later ones. */
export function parseGitOps(command: string): ParsedGitOp[] {
  const out: ParsedGitOp[] = [];
  let dir = ".";
  for (const words of segments(command)) {
    if (words[0] === "cd" && words[1]) {
      dir = words[1].startsWith("/") ? words[1] : posix.join(dir, words[1]);
      continue;
    }
    const op = parseGit(words, dir);
    if (op) out.push(op);
  }
  return out;
}

/** The op that best describes the command; commit files still matter when it is chained before a push. */
export function primaryOp(ops: ParsedGitOp[]): ParsedGitOp | undefined {
  return ops.reduce<ParsedGitOp | undefined>(
    (best, o) => (!best || WEIGHT[o.op] >= WEIGHT[best.op] ? o : best),
    undefined,
  );
}

const VALUE_FLAGS = new Set(["-m", "-s", "-X", "-F", "-c", "-C", "-o", "--strategy", "--strategy-option"]);

function positionals(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    if (a === "--") break;
    if (VALUE_FLAGS.has(a)) i++;
    else if (!a.startsWith("-")) out.push(a);
  }
  return out;
}

/** What the op points at: `remote/branch` for push/pull, the source for merge/rebase, the branch for checkout. */
export function opTarget(op: ParsedGitOp, currentBranch: string | undefined): string | undefined {
  const pos = positionals(op.args);
  switch (op.op) {
    case "push":
    case "pull": {
      const remote = pos[0] ?? "origin";
      const ref = pos[1];
      const dst = ref?.includes(":") ? ref.slice(ref.indexOf(":") + 1) : ref;
      const branch = !dst || dst === "HEAD" ? currentBranch : dst.replace(/^refs\/heads\//, "");
      return branch ? `${remote}/${branch}` : remote;
    }
    case "checkout": {
      if (op.args.includes("--")) return undefined;
      const create = op.args.findIndex((a) => a === "-b" || a === "-B" || a === "-c" || a === "-C");
      if (create >= 0) return op.args[create + 1];
      return pos[0];
    }
    case "merge":
    case "rebase":
      return pos[0];
    case "commit":
      return undefined;
  }
}

/** Branch part of a `remote/branch` target, or the target itself. */
export function targetBranch(target: string | undefined): string | undefined {
  if (!target) return undefined;
  const slash = target.indexOf("/");
  return slash >= 0 ? target.slice(slash + 1) : target;
}
