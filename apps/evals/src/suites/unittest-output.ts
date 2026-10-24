/**
 * Per-test outcomes from a verbose unittest run (Django's `runtests.py -v 2`). A test id is
 * `module.Class.method`. Tests listed in a FAIL/ERROR block failed, including subtest failures; every
 * other listed test passed unless it was skipped.
 */
export type TestStatus = "pass" | "fail" | "skip";

const HEADER = /^(\w+) \(([\w.]+)\)/;
const VERDICT = /\.\.\. (ok|FAIL|ERROR|skipped|expected failure|unexpected success)/;
const FAILED = /^(?:FAIL|ERROR): (\w+) \(([\w.]+)\)/;

export function parseUnittest(out: string): Map<string, TestStatus> {
  const status = new Map<string, TestStatus>();
  let pending: string | null = null;
  const settle = (id: string, verdict: string) => {
    if (status.get(id) === "fail") return;
    status.set(
      id,
      verdict === "ok" || verdict === "expected failure" ? "pass" : verdict === "skipped" ? "skip" : "fail",
    );
  };
  for (const line of out.split("\n")) {
    const failed = FAILED.exec(line);
    if (failed?.[2]) {
      status.set(failed[2], "fail");
      continue;
    }
    const head = HEADER.exec(line);
    if (head?.[2]) pending = head[2];
    const verdict = VERDICT.exec(line);
    if (verdict?.[1] && pending) {
      settle(pending, verdict[1]);
      pending = null;
    }
  }
  return status;
}

/** True when a method name has at least one run and every run of it passed. */
export function namePasses(status: Map<string, TestStatus>, method: string): boolean {
  const runs = [...status].filter(([id]) => id.endsWith(`.${method}`));
  return runs.length > 0 && runs.every(([, s]) => s === "pass");
}

export type Interference = { count: number; tests: string[] };

/**
 * STALE-bench's Δblind with the corrected grading: a test counts when it passes with the branch that owns it
 * alone (its PR's fail-to-pass list), or with both branches alone for any other test, and fails merged.
 */
export function interference(
  solo: { status: Map<string, TestStatus>; owns: string[] }[],
  merged: Map<string, TestStatus>,
): Interference {
  const ids = new Set(solo.flatMap((s) => [...s.status.keys()]));
  const tests: string[] = [];
  for (const id of ids) {
    const method = id.split(".").pop() ?? id;
    const owners = solo.filter((s) => s.owns.includes(method));
    const judges = owners.length ? owners : solo;
    const soloPass = judges.every((s) => s.status.get(id) === "pass");
    if (soloPass && merged.get(id) !== "pass") tests.push(id);
  }
  return { count: tests.length, tests: tests.sort() };
}
