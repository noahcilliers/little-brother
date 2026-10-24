import { describe, expect, it } from "vitest";
import { failedIds } from "../src/suites/cooperbench";
import { patchFiles } from "../src/suites/grade-tree";
import { suiteArm } from "../src/suites/report-suite";
import type { PairRecord } from "../src/suites/run-pair";
import { asCase } from "../src/suites/run-pair";
import { HELPERS, mechanismProbe, oracleAssert, splitArgs, taskA, taskB } from "../src/suites/stale-specs";
import { cleanBody, csvRecords } from "../src/suites/trac";
import { interference, namePasses, parseUnittest } from "../src/suites/unittest-output";

const VERBOSE = `test_alpha (utils_tests.test_text.TestUtilsText.test_alpha) ... ok
test_beta (utils_tests.test_text.TestUtilsText.test_beta)
Docstring first line. ... FAIL
test_gamma (utils_tests.test_text.TestUtilsText.test_gamma) ... skipped 'no'
test_delta (utils_tests.test_text.TestUtilsText.test_delta) ... ok

======================================================================
FAIL: test_delta (utils_tests.test_text.TestUtilsText.test_delta) (value='x')
----------------------------------------------------------------------
`;

describe("unittest output", () => {
  it("reads verdicts, docstring lines and subtest failures", () => {
    const s = parseUnittest(VERBOSE);
    expect(s.get("utils_tests.test_text.TestUtilsText.test_alpha")).toBe("pass");
    expect(s.get("utils_tests.test_text.TestUtilsText.test_beta")).toBe("fail");
    expect(s.get("utils_tests.test_text.TestUtilsText.test_gamma")).toBe("skip");
    expect(s.get("utils_tests.test_text.TestUtilsText.test_delta")).toBe("fail");
    expect(namePasses(s, "test_alpha")).toBe(true);
    expect(namePasses(s, "test_missing")).toBe(false);
  });

  it("counts Δblind: passes with the owning branch alone, fails merged", () => {
    const pass = new Map([
      ["m.C.test_a", "pass" as const],
      ["m.C.test_b", "pass" as const],
      ["m.C.test_shared", "pass" as const],
    ]);
    const aOnly = new Map([...pass, ["m.C.test_b", "fail" as const]]);
    const bOnly = new Map([...pass, ["m.C.test_a", "fail" as const]]);
    const merged = new Map([...pass, ["m.C.test_a", "fail" as const], ["m.C.test_shared", "fail" as const]]);
    const r = interference(
      [
        { status: aOnly, owns: ["test_a"] },
        { status: bOnly, owns: ["test_b"] },
      ],
      merged,
    );
    expect(r).toEqual({ count: 2, tests: ["m.C.test_a", "m.C.test_shared"] });
  });
});

describe("STALE-bench constructed specs", () => {
  const h = HELPERS.phone2numeric;
  it("turns the benchmark's assertEqual oracle into a plain assert", () => {
    expect(splitArgs("m.f('a, b', [1, 2]), 'x'")).toEqual(["m.f('a, b', [1, 2])", "'x'"]);
    expect(oracleAssert("self.assertEqual(m.phone2numeric_clean('800-COLLECT'), '8002655328')")).toBe(
      "got = m.phone2numeric_clean('800-COLLECT'); assert got == '8002655328', repr(got)",
    );
    expect(() => oracleAssert("self.assertTrue(x)")).toThrow();
  });

  it("writes concrete task A prompts and probes for each mechanism", () => {
    if (!h) throw new Error("missing spec");
    expect(taskA(h, "rename")).toContain("to `phone_to_numeric`");
    expect(taskA(h, "signature")).toContain("keyword-only parameter `strict`");
    expect(taskA(h, "rettype")).toContain("`PhoneNumber`");
    expect(taskB(h, "Add x.")).toMatch(/^In `django\/utils\/text.py`: Add x\./);
    expect(mechanismProbe(h, "rename")).toContain("not hasattr(m, 'phone2numeric')");
  });
});

describe("Trac and PR text", () => {
  it("drops the PR template", () => {
    const body = "#### Trac ticket number\r\nticket-1\r\n<!-- hi -->\r\nReal text.\r\n- [x] tests";
    expect(cleanBody(body)).toBe("ticket-1\n\nReal text.");
  });

  it("parses quoted CSV fields with commas, quotes and newlines", () => {
    expect(csvRecords('id,description\n1,"a, ""b""\nc"\n')).toEqual([
      ["id", "description"],
      ["1", 'a, "b"\nc'],
    ]);
  });
});

describe("CooperBench helpers", () => {
  it("lists a patch's files and pytest's failed ids", () => {
    expect(patchFiles("--- a/tests/x.py\n+++ b/tests/x.py\n@@\n+++ b/src/y.py\n")).toEqual([
      "tests/x.py",
      "src/y.py",
    ]);
    expect(failedIds("FAILED tests/t.py::test_zip - TypeError\nERROR tests/t.py::test_e\nFAILED x")).toEqual([
      "tests/t.py::test_zip",
      "tests/t.py::test_e",
    ]);
  });
});

describe("pair runs", () => {
  it("map onto the planted case shape, controls expecting nothing", () => {
    const task = {
      suite: "stale" as const,
      id: "t",
      kind: "control",
      repoCache: "",
      base: "",
      agents: [
        { handle: "noah", prompt: "A" },
        { handle: "ash", prompt: "B", afterFirstEditOf: "noah" },
      ],
      expectClash: false,
      env: () => ({}),
      extraTools: [],
      grade: async () => {
        throw new Error("unused");
      },
    };
    expect(asCase(task).expect).toEqual([]);
    expect(asCase({ ...task, expectClash: true }).expect[0]?.agents).toEqual(["noah", "ash"]);
    expect(asCase(task).agents[1]?.start?.after).toEqual({ agent: "noah", event: "firstEdit" });
  });

  it("rates interference over clean merges only", () => {
    const rec = (interference: number | null, mergeConflict: boolean, success: boolean): PairRecord => ({
      suite: "stale",
      kind: "coupled",
      caseId: "t",
      variant: "pointed",
      arm: "off",
      run: 1,
      score: { control: false, expectations: [], falsePositives: [] },
      costUsd: 0,
      wallSec: 0,
      grade: {
        mergeConflict,
        success,
        interference,
        solved: { a: true, b: !mergeConflict },
        clash: false,
        detail: {},
      },
    });
    const s = suiteArm([rec(1, false, false), rec(0, false, true), rec(null, true, false)]);
    expect(s).toMatchObject({ runs: 3, interferenceRate: 0.5, mergeConflicts: 1, successRate: 1 / 3 });
    expect(s.soloSolveRate).toBeCloseTo(5 / 6);
  });
});
