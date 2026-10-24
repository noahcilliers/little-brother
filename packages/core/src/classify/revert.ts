import type { Outcome } from "../nodes";

export type RevertStep = {
  id: string;
  verb: string;
  outcome: Outcome;
  files: string[];
  at: number;
};

const CHANGE_VERBS = new Set(["EDIT", "FIX"]);

/** "." stands for the whole tree (`git reset --hard`); a directory covers everything under it. */
function covers(reverted: string, file: string): boolean {
  if (reverted === "." || reverted === file) return true;
  const dir = reverted.endsWith("/") ? reverted : `${reverted}/`;
  return file.startsWith(dir);
}

/**
 * The edits a revert throws away as a failed attempt: when the last test before the revert failed, every
 * edit to a reverted path since the last green test. Those edits are failure memory, so the next agent who
 * makes the same change gets the warning (R10) without any model in the loop. Reverting after a green test,
 * or with no test at all, is tidying up, not failure, and returns nothing.
 */
export function revertedEdits(steps: RevertStep[], revert: { paths: string[]; at: number }): string[] {
  const before = steps.filter((s) => s.at < revert.at).sort((a, b) => a.at - b.at);
  const tests = before.filter((s) => s.verb === "TEST" && s.outcome !== "open");
  const lastTest = tests[tests.length - 1];
  if (lastTest?.outcome !== "failed") return [];
  const greens = tests.filter((s) => s.outcome === "succeeded");
  const since = greens[greens.length - 1]?.at ?? Number.NEGATIVE_INFINITY;
  return before
    .filter(
      (s) =>
        CHANGE_VERBS.has(s.verb) &&
        s.at > since &&
        s.outcome !== "failed" &&
        s.outcome !== "superseded" &&
        s.files.some((f) => revert.paths.some((p) => covers(p, f))),
    )
    .map((s) => s.id);
}
