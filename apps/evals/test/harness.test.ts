import { describe, expect, it } from "vitest";
import { CASES } from "../cases";
import { caseProblems, type EvalCase, startOrder } from "../src/case";
import { applyLine, emptyLog, logTokens, redirectTargets } from "../src/stream";
import { type AgentState, dueAt } from "../src/triggers";

describe("cases", () => {
  it.each(CASES.map((c) => [c.id, c] as const))("%s is sound", (_id, c) => {
    expect(caseProblems(c)).toEqual([]);
  });

  it("has unique ids", () => {
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
  });

  it("rejects trigger cycles", () => {
    const cyclic: EvalCase = {
      id: "x",
      title: "x",
      why: "x",
      agents: [
        {
          handle: "a",
          prompt: { pointed: "", natural: "" },
          start: { after: { agent: "b", event: "done" } },
        },
        {
          handle: "b",
          prompt: { pointed: "", natural: "" },
          start: { after: { agent: "a", event: "done" } },
        },
      ],
      expect: [],
      checks: [],
    };
    expect(startOrder(cyclic)).toBeNull();
    expect(caseProblems(cyclic)).toContain("start triggers form a cycle");
  });
});

describe("dueAt", () => {
  const state = (s: Partial<AgentState>): AgentState => ({
    startedAt: 0,
    firstEditAt: null,
    doneAt: null,
    ...s,
  });

  it("counts plain delays from the run start", () => {
    expect(dueAt({ delaySec: 5 }, 1000, new Map())).toEqual({ at: 6000, fallback: false });
  });

  it("waits for the trigger event, then the delay", () => {
    const states = new Map([["a", state({})]]);
    expect(dueAt({ after: { agent: "a", event: "firstEdit" }, delaySec: 2 }, 0, states)).toBeNull();
    states.set("a", state({ firstEditAt: 4000 }));
    expect(dueAt({ after: { agent: "a", event: "firstEdit" }, delaySec: 2 }, 0, states)).toEqual({
      at: 6000,
      fallback: false,
    });
  });

  it("falls back to the other agent finishing when it never edited", () => {
    const states = new Map([["a", state({ doneAt: 9000 })]]);
    expect(dueAt({ after: { agent: "a", event: "firstEdit" } }, 0, states)).toEqual({
      at: 9000,
      fallback: true,
    });
  });
});

describe("applyLine", () => {
  const root = "/w";
  const use = (id: string, name: string, input: object) =>
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } });
  const result = (id: string, isError: boolean, content: string) =>
    JSON.stringify({
      type: "user",
      message: { content: [{ type: "tool_result", tool_use_id: id, is_error: isError, content }] },
    });

  it("records touched files and fires on the first successful edit only", () => {
    const log = emptyLog();
    applyLine(log, use("1", "Write", { file_path: "/w/db/schema/users.ts" }), root, 1);
    expect(applyLine(log, result("1", true, "[little-brother] duplicate · owned by noah"), root, 2)).toBe(
      false,
    );
    expect(log.touched.has("db/schema/users.ts")).toBe(true);
    expect(log.lbMessages).toHaveLength(1);
    applyLine(log, use("2", "Edit", { file_path: "/w/src/a.ts" }), root, 3);
    expect(applyLine(log, result("2", false, "ok"), root, 4)).toBe(true);
    applyLine(log, use("3", "Edit", { file_path: "/w/src/b.ts" }), root, 5);
    expect(applyLine(log, result("3", false, "ok"), root, 6)).toBe(false);
    expect(log.firstEditAt).toBe(4);
  });

  it("collects Bash commands and the final result", () => {
    const log = emptyLog();
    applyLine(log, use("1", "Bash", { command: "npm test" }), root, 1);
    applyLine(
      log,
      JSON.stringify({ type: "result", total_cost_usd: 0.25, num_turns: 4, result: "done" }),
      root,
      2,
    );
    expect(log).toMatchObject({
      commands: ["npm test"],
      costUsd: 0.25,
      turns: 4,
      finished: true,
      resultText: "done",
    });
  });

  it("counts each message's usage once, keeping its largest counts", () => {
    const log = emptyLog();
    const msg = (id: string | undefined, output: number) =>
      JSON.stringify({
        type: "assistant",
        message: {
          ...(id ? { id } : {}),
          usage: { input_tokens: 5, output_tokens: output, cache_read_input_tokens: 1000 },
          content: [{ type: "text", text: "x" }],
        },
      });
    applyLine(log, msg("m1", 3), root, 1);
    applyLine(log, msg("m1", 40), root, 2);
    applyLine(log, msg("m2", 7), root, 3);
    applyLine(log, msg(undefined, 1), root, 4);
    expect(logTokens(log)).toEqual({ input: 15, output: 48, cacheCreation: 0, cacheRead: 3000 });
  });

  it("ignores lines it doesn't understand", () => {
    const log = emptyLog();
    expect(applyLine(log, "not json", root, 1)).toBe(false);
    expect(applyLine(log, JSON.stringify({ type: "stream_event" }), root, 1)).toBe(false);
  });
});

describe("redirectTargets", () => {
  it("finds files written by redirects and tee, not fd redirects or /dev/null", () => {
    expect(redirectTargets("mkdir -p db && cat > db/schema/orders.ts <<'EOF'\nx\nEOF")).toEqual([
      "db/schema/orders.ts",
    ]);
    expect(redirectTargets("echo hi >> 'notes.md' && npm test 2>&1 | tee out.log")).toEqual([
      "notes.md",
      "out.log",
    ]);
    expect(redirectTargets("npm test 2>&1 > /dev/null")).toEqual([]);
    expect(redirectTargets("cat > a.ts <<'E'\nexport const f = () => 1;\nE")).toEqual(["a.ts"]);
    expect(redirectTargets("node -e 'const f = (x) => x'")).toEqual([]);
  });
});
