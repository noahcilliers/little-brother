import { describe, expect, it } from "vitest";
import { CASES } from "../cases";
import type { RunRecord } from "../src/aggregate";
import { compareArms } from "../src/arm-stats";
import { ledgerTotal } from "../src/budget";
import { catchIdOf, distinctCatchSavings } from "../src/catches";
import { compareVersions } from "../src/claude-bin";
import { convexDeployment, isLocalSite } from "../src/convex-target";
import { fixupPrompt } from "../src/fixup";
import { matchingFiles } from "../src/grep-ref";
import { parseOptions } from "../src/options";
import { meanSe, pairedSchedule, pairedSummary, pairs } from "../src/paired";
import { armsSection } from "../src/report-arms";

const run = (arm: "on" | "off", over: Partial<RunRecord> = {}): RunRecord => ({
  caseId: "c",
  variant: "pointed",
  arm,
  run: 1,
  score: { control: false, expectations: [], falsePositives: [] },
  costUsd: 0.1,
  tokens: { input: 0, output: 1000, cacheCreation: 0, cacheRead: 5000 },
  wallSec: 60,
  ...over,
});

describe("matchingFiles", () => {
  it("matches \\s, \\w and \\b, which macOS git grep -E silently doesn't", () => {
    const files: [string, string][] = [
      ["vitest.config.ts", 'export default {\n  test: { environment: "jsdom" },\n};'],
      ["other.ts", "const environment = 'node';"],
    ];
    expect(matchingFiles(files, "environment:\\s*[\"'`]jsdom")).toEqual(["vitest.config.ts"]);
    expect(matchingFiles([["a.ts", "export function findUserByEmail(e) {}"]], "find\\w*ByEmail\\b")).toEqual([
      "a.ts",
    ]);
  });

  it("matches line by line, like git grep", () => {
    expect(matchingFiles([["a.ts", "environment:\n'jsdom'"]], "environment:\\s*'jsdom")).toEqual([]);
  });
});

describe("distinctCatchSavings", () => {
  it("credits each catch once, by catchKey, else by pair and type", () => {
    const rows = [
      { type: "duplicate", agents: ["a", "b"], tokensSaved: 5000, catchKey: "k1" },
      { type: "duplicate", agents: ["a", "b"], tokensSaved: 5000, catchKey: "k1" },
      { type: "duplicate", agents: ["b", "a"], tokensSaved: 6000, catchKey: "k1" },
      { type: "conflict", agents: ["a", "c"], tokensSaved: 1000 },
      { type: "conflict", agents: ["c", "a"], tokensSaved: 1000, catchKey: null },
      { type: "normal", agents: ["a", "d"], tokensSaved: 9999 },
    ];
    expect(distinctCatchSavings(rows)).toEqual({ catches: 2, tokensSaved: 7000 });
    expect(catchIdOf({ type: "conflict", agents: ["c", "a"] })).toBe("a+c:conflict");
  });
});

describe("paired design", () => {
  it("keeps each block's runs adjacent and is deterministic for a seed", () => {
    const blocks = [1, 2, 3, 4].map((b) => [
      { arm: "off" as const, b },
      { arm: "on" as const, b },
    ]);
    const a = pairedSchedule(blocks, 7);
    expect(a).toEqual(pairedSchedule(blocks, 7));
    for (let i = 0; i < a.length; i += 2) expect(a[i]?.b).toBe(a[i + 1]?.b);
    expect(new Set(a.map((x) => x.b)).size).toBe(4);
  });

  it("differences off − on per block, with the standard error of the mean difference", () => {
    const runs = [
      run("off", { run: 1, tokens: { input: 0, output: 30_000, cacheCreation: 0, cacheRead: 0 } }),
      run("on", { run: 1, tokens: { input: 0, output: 20_000, cacheCreation: 0, cacheRead: 0 } }),
      run("off", { run: 2, tokens: { input: 0, output: 40_000, cacheCreation: 0, cacheRead: 0 } }),
      run("on", { run: 2, tokens: { input: 0, output: 10_000, cacheCreation: 0, cacheRead: 0 } }),
      run("on", { run: 3 }),
      run("off", { run: 4, error: "boom" }),
      run("on", { run: 4 }),
    ];
    expect(pairs(runs)).toHaveLength(2);
    const s = pairedSummary(runs);
    expect(s.tokens.mean).toBe(20_000);
    // Differences 10k and 30k: sample sd 14.1k, so the standard error of their mean is 10k.
    expect(s.tokens.se).toBeCloseTo(10_000);
    expect(meanSe([1]).se).toBeNull();
  });

  it("success differences are on − off", () => {
    const s = pairedSummary([run("off", { finalSuccess: false }), run("on", { finalSuccess: true })]);
    expect(s.success.mean).toBe(1);
  });
});

describe("arm comparison", () => {
  it("summarizes each arm and renders a paired table", () => {
    const runs = [
      run("off", { finalSuccess: true, mergeConflict: true }),
      run("on", { finalSuccess: true, mergeConflict: false, catches: 1 }),
    ];
    const c = compareArms(runs);
    expect(c.off.finalSuccess).toBe(1);
    expect(c.on.catchesPerRun).toBe(1);
    expect(c.off.mergeConflictRate).toBe(1);
    expect(armsSection("Planted", c).join("\n")).toContain("Paired differences over 1");
  });
});

describe("budget ledger", () => {
  it("sums costs and skips bad lines", () => {
    const line = (c: number) => JSON.stringify({ at: "t", suite: "s", run: "r", costUsd: c });
    expect(ledgerTotal(`${line(1.5)}\nnot json\n${line(0.25)}\n\n`)).toBe(1.75);
  });
});

describe("claude binary", () => {
  it("orders versions numerically", () => {
    expect(compareVersions("2.1.310", "2.1.301")).toBeGreaterThan(0);
    expect(compareVersions("2.10.0", "2.9.9")).toBeGreaterThan(0);
    expect(compareVersions("2.1", "2.1.0")).toBe(0);
  });
});

describe("convex target", () => {
  it("knows a local site and refuses production", () => {
    expect(isLocalSite("http://127.0.0.1:3211")).toBe(true);
    expect(isLocalSite("https://fantastic-meerkat-18.convex.site")).toBe(false);
    process.env.LB_EVAL_CONVEX_DEPLOYMENT = "prod:fantastic-meerkat-18";
    expect(() => convexDeployment("/nowhere", "http://127.0.0.1:3211")).toThrow(/refusing/);
    delete process.env.LB_EVAL_CONVEX_DEPLOYMENT;
    expect(convexDeployment("/nowhere", "http://127.0.0.1:3211")).toBeNull();
  });
});

describe("fix-up step", () => {
  it("names every teammate's task, the conflict and the commands", () => {
    const p = fixupPrompt(
      [
        { handle: "noah", prompt: "Build A." },
        { handle: "ash", prompt: "Build B." },
      ],
      true,
      ["npm run typecheck"],
    );
    expect(p).toContain("conflict markers");
    expect(p).toContain("Teammate 2 (ash) was asked: Build B.");
    expect(p).toContain("- `npm run typecheck`");
  });

  it("every case's success patterns compile", () => {
    for (const c of CASES)
      for (const i of c.success?.intact ?? []) expect(() => new RegExp(i.pattern)).not.toThrow();
  });
});

describe("new options", () => {
  it("defaults to fix-up on, unpaired, a $60 cap and the planted suite", () => {
    const o = parseOptions([]);
    expect(o).toMatchObject({ fixup: true, paired: false, seed: 1, capUsd: 60, suite: "planted" });
    expect(parseOptions(["--no-fixup", "--paired", "--seed", "3", "--suite", "stale"])).toMatchObject({
      fixup: false,
      paired: true,
      seed: 3,
      suite: "stale",
    });
    expect(() => parseOptions(["--suite", "nope"])).toThrow();
  });
});
