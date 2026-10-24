import { z } from "zod";
import { activeProfile } from "../config";
import { postJson } from "../http";
import { type Conflict, git } from "./git";

const Branches = z.array(z.object({ handle: z.string(), branch: z.string() }));

export type MergeCheckDeps = {
  git: typeof git;
  post: (path: string, body: unknown) => Promise<unknown>;
};

/** `git merge-tree` exit 1 means conflicts; the first output line is the tree id, then the conflicted files. */
export function mergeTreeConflict(root: string, mine: string, theirs: string, run = git): Conflict | null {
  const r = run(root, [
    "merge-tree",
    "--write-tree",
    "--name-only",
    "--no-messages",
    "HEAD",
    `origin/${theirs}`,
  ]);
  if (r.code !== 1) return null;
  return { a: mine, b: theirs, files: r.out.trim().split("\n").slice(1).filter(Boolean) };
}

/**
 * Best-effort R3 between this checkout and every other active agent's pushed branch. Reports conflicts only:
 * a clean background merge says nothing about tests, so it must not become a "clean" label.
 */
export async function backgroundMergeCheck(
  root: string,
  sessionId: string,
  deps: MergeCheckDeps,
): Promise<Conflict[]> {
  const mine = deps.git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
  if (!mine || mine === "HEAD") return [];
  if (deps.git(root, ["fetch", "--quiet", "origin"]).code !== 0) return [];
  const res = await deps.post("/mcp/branches", { claudeSessionId: sessionId, args: {} });
  const text = z.object({ text: z.string() }).safeParse(res);
  const others = text.success ? Branches.safeParse(JSON.parse(text.data.text)) : null;
  if (!others?.success) return [];
  const found: Conflict[] = [];
  for (const theirs of new Set(others.data.map((o) => o.branch))) {
    if (!theirs || theirs === mine) continue;
    if (deps.git(root, ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${theirs}`]).code !== 0)
      continue;
    const c = mergeTreeConflict(root, mine, theirs, deps.git);
    if (!c) continue;
    found.push(c);
    await deps.post("/verify", {
      branches: [mine, theirs],
      passed: true,
      outputTail: "background merge-tree",
      conflicts: [c],
      background: true,
    });
  }
  return found;
}

/** Entry for the detached `lb merge-check` child. Silent: nobody is watching its output. */
export async function mergeCheckCommand(opts: { repo: string; session: string; as?: string }): Promise<void> {
  const p = activeProfile(opts.as);
  if (!p) return;
  const post = (path: string, body: unknown) =>
    postJson(`${p.siteUrl}${path}`, body, { token: p.token, timeoutMs: 10_000 });
  await backgroundMergeCheck(opts.repo, opts.session, { git, post }).catch(() => []);
}
