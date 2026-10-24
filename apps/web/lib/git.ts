import { ago } from "./format";

export type GitStatus = "confirmed" | "clean" | "missed";
export type Landed = "committed" | "pushed" | "merged";
export type GitOp = { op: string; ok: boolean; sha?: string; target?: string; at: number };

const GIT_LABEL: Record<GitStatus, string> = {
  confirmed: "git: confirmed",
  clean: "git: clean",
  missed: "missed live · found by git",
};

export function gitLabel(s: GitStatus | undefined): string {
  return s ? GIT_LABEL[s] : "";
}

export function shortSha(sha: string | undefined): string {
  return sha ? sha.slice(0, 7) : "";
}

const PAST: Record<string, string> = {
  commit: "committed",
  push: "pushed",
  merge: "merged",
  rebase: "rebased",
};

/** "pushed → origin/main 3m ago · a1b2c3d"; the caller strikes it through when the op failed. */
export function gitOpText(g: GitOp, now = Date.now()): string {
  const verb = PAST[g.op] ?? g.op;
  const target = g.target ? ` → ${g.target}` : "";
  const sha = g.sha ? ` · ${shortSha(g.sha)}` : "";
  return `${verb}${g.ok ? "" : " (failed)"}${target} ${ago(g.at, now)}${sha}`;
}

/** Pushed or merged work is already in the shared history, so it no longer blocks anyone. */
export function settledInGit(landed: Landed | undefined): boolean {
  return landed === "pushed" || landed === "merged";
}

export function landedText(c: Record<Landed, number>): string {
  const parts = (["merged", "pushed", "committed"] as const)
    .filter((k) => c[k] > 0)
    .map((k) => `${c[k]} ${k}`);
  return parts.length > 0 ? parts.join(" · ") : "nothing landed";
}

/** Split an LLM side-by-side into its two sides when it labels them; otherwise show it whole. */
export function splitComparison(
  text: string,
): { left: string; right: string; leftHead: string; rightHead: string } | null {
  const lines = text.split("\n");
  const marker = /^\s*(?:#+\s*)?(?:\*\*)?(A|B|existing|new|left|right|side a|side b)\b(?:\*\*)?\s*[:·—-]/i;
  const starts = lines.flatMap((l, i) => (marker.test(l) ? [i] : []));
  if (starts.length !== 2) return null;
  const [a, b] = starts as [number, number];
  return {
    leftHead: lines[a]?.trim() ?? "",
    left: lines
      .slice(a + 1, b)
      .join("\n")
      .trim(),
    rightHead: lines[b]?.trim() ?? "",
    right: lines
      .slice(b + 1)
      .join("\n")
      .trim(),
  };
}
