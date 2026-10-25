import type { EvalRunRow } from "@lb/core";
import { describe, expect, it } from "vitest";
import { classifierBench, replayLatencies } from "../src/publish-classifier";
import { contrastFor, pickReplayRow } from "../src/publish-pick";
import { MAX_EVENTS, replayEvents } from "../src/publish-replay";
import { isVoidedStream, PublishedRecord, toRunRow } from "../src/publish-row";
import { cleanLine } from "../src/publish-text";

const ROOT = "/private/tmp/lb-evals/1025/case-on-1/ash";
const line = (o: unknown) => JSON.stringify(o);
const ts = (s: number) => new Date(Date.UTC(2026, 9, 25, 1, 0, s)).toISOString();
const use = (s: number, name: string, input: unknown) =>
  line({
    type: "assistant",
    timestamp: ts(s),
    message: { content: [{ type: "tool_use", id: "t", name, input }] },
  });
const result = (s: number, text: string, isError: boolean) =>
  line({
    type: "user",
    timestamp: ts(s),
    message: { content: [{ type: "tool_result", tool_use_id: "t", is_error: isError, content: text }] },
  });

describe("replayEvents", () => {
  const ash = [
    line({ type: "system", subtype: "init", cwd: ROOT }),
    use(1, "Read", { file_path: `${ROOT}/src/a.ts` }),
    use(2, "Edit", { file_path: `${ROOT}/src/a.ts` }),
    result(3, "PreToolUse:Edit hook error: [little-brother] conflict · both edit src/a.ts", true),
    use(4, "Bash", { command: `cd ${ROOT}; npm test 2>&1 | tail` }),
    use(5, "Bash", { command: "cat > x.sh <<'EOF'\nnpm test\nEOF" }),
    use(6, "mcp__lb__post_decision", { topic: "auth.mech = jwt" }),
  ].join("\n");
  const hooks = [
    line({ event: "PreToolUse", tool: "Edit", at: Date.parse(ts(3)), decision: "deny" }),
    line({ event: "PreToolUse", tool: "Write", at: Date.parse(ts(9)), decision: "deny" }),
  ].join("\n");
  const noah = [use(0, "Grep", { pattern: "foo" }), "not json"].join("\n");

  it("merges agents by time, relativizes paths and classifies each line", () => {
    const events = replayEvents([
      { handle: "ash", stream: ash, hooks },
      { handle: "noah", stream: noah, hooks: "" },
    ]);
    expect(events.map((e) => [e.t, e.agent, e.kind, e.text])).toEqual([
      [0, "noah", "tool", "Grep foo"],
      [1000, "ash", "tool", "Read src/a.ts"],
      [2000, "ash", "edit", "Edit src/a.ts"],
      [3000, "ash", "deny", "conflict · both edit src/a.ts"],
      [4000, "ash", "test", "$ npm test 2>&1 | tail"],
      [5000, "ash", "tool", "$ cat > x.sh <<'EOF'"],
      [6000, "ash", "decision", "lb.post_decision auth.mech = jwt"],
      [9000, "ash", "deny", "blocked Write"],
    ]);
  });

  it("keeps a deny once when the hook response repeats it", () => {
    const echo = line({
      type: "system",
      subtype: "hook_response",
      hook_event: "PreToolUse",
      output: JSON.stringify({
        hookSpecificOutput: { permissionDecisionReason: "[little-brother] conflict · x" },
      }),
    });
    const stream = [
      use(1, "Edit", { file_path: "a" }),
      echo,
      result(2, "[little-brother] conflict · x", true),
    ];
    const events = replayEvents([{ handle: "a", stream: stream.join("\n"), hooks: "" }]);
    expect(events.filter((e) => e.kind !== "edit")).toEqual([
      { t: 1000, agent: "a", kind: "deny", text: "conflict · x" },
    ]);
  });

  it("thins reads past the cap but never drops a catch", () => {
    const many = Array.from({ length: 80 }, (_, i) => use(i, "Read", { file_path: `f${i}` }));
    many.push(result(81, "[little-brother] stale · f1 changed", false));
    const events = replayEvents([{ handle: "a", stream: many.join("\n"), hooks: "" }]);
    expect(events).toHaveLength(MAX_EVENTS);
    expect(events.at(-1)?.kind).toBe("catch");
  });
});

describe("text cleaning", () => {
  it("masks credentials and clips to one row", () => {
    expect(cleanLine("export API_TOKEN=abc123 && curl -H 'Bearer xyz'", [])).toBe(
      "export API_TOKEN=[redacted] && curl -H '[redacted]",
    );
    expect(cleanLine(`${"x".repeat(200)}\nsecond`, [])).toHaveLength(160);
  });
});

const record = (over: Record<string, unknown> = {}) =>
  PublishedRecord.parse({
    caseId: "dup",
    variant: "pointed",
    run: 1,
    score: {
      expectations: [{ outcome: "hit", detectSec: 4, row: { relation: "textual_conflict" } }],
      falsePositives: [],
    },
    costUsd: 0.2,
    tokens: { input: 10, output: 20, cacheCreation: 70, cacheRead: 9000 },
    wallSec: 60,
    grade: { interference: null },
    finalSuccess: true,
    mergeConflict: false,
    agents: [
      { handle: "a", startedAt: 50 },
      { handle: "b", startedAt: 40 },
    ],
    ...over,
  });
const meta = { batch: "p/large", suite: "large", model: "sonnet", voided: false, fallbackAt: 0 };

describe("toRunRow", () => {
  it("maps a run record to a published row", () => {
    expect(toRunRow(record(), meta)).toMatchObject({
      runKey: "p/large/dup/pointed/on/1",
      suite: "large",
      arm: "on",
      newTokens: 100,
      hits: 1,
      detectSec: 4,
      interference: null,
      at: 40,
      voided: false,
    });
  });

  it("voids rate-limited streams and harness errors, not null API statuses", () => {
    expect(isVoidedStream('{"api_error_status":429}')).toBe(true);
    expect(isVoidedStream('{"api_error_status":null}')).toBe(false);
    expect(toRunRow(record({ error: "boom" }), meta).voided).toBe(true);
  });
});

describe("replay pick", () => {
  const row = (over: Partial<EvalRunRow>) => ({ ...toRunRow(record(), meta), ...over });
  const rows = [
    row({ runKey: "fast-no-contrast", caseId: "other", wallSec: 10 }),
    row({ runKey: "slow", wallSec: 90 }),
    row({ runKey: "voided", wallSec: 5, voided: true }),
    row({ runKey: "off1", arm: "off", mergeConflict: true, costUsd: 0.4 }),
    row({ runKey: "off2", arm: "off", mergeConflict: false, costUsd: 0.2 }),
  ];

  it("prefers a caught run whose off-arm twin hit merge conflicts", () => {
    expect(pickReplayRow(rows)?.runKey).toBe("slow");
    expect(contrastFor(rows, row({}))).toMatchObject({
      runs: 2,
      mergeConflicts: 1,
      meanCostUsd: 0.30000000000000004,
    });
  });
});

describe("classifierBench", () => {
  const md = "| pair model only | 0.79 | 0.07 ms |\n| llm every pair  | 1.00 | 7.0 s          |\n";
  it("reads settle numbers and replay latencies", () => {
    expect(replayLatencies(md)).toEqual({ modelMs: 0.07, judgeMs: 7000 });
    const bench = classifierBench(
      {
        version: "v2",
        goldRows: 10,
        groups: 2,
        perRelation: { independent: { f1: 0.5, support: 4 }, duplicate: { f1: null, support: 6 } },
        settle: { pairsReachingModel: 8, settledByModel: 2, settledShare: 0.25, settledAccuracy: 1 },
        settleByRelation: { independent: { settled: 2, precision: 1 } },
      },
      md,
      7,
    );
    expect(bench.relations).toEqual([
      { relation: "independent", support: 4, f1: 0.5, settled: 2, settledPrecision: 1 },
      { relation: "duplicate", support: 6, f1: null, settled: 0, settledPrecision: null },
    ]);
    expect(bench).toMatchObject({
      openPairs: 8,
      settledShare: 0.25,
      modelMsPerPair: 0.07,
      judgeMsPerPair: 7000,
    });
  });
});
