import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FEATURE_NAMES } from "@lb/core";
import { describe, expect, it } from "vitest";
import { exportPairs, nodeFromText, pairsFromRun, type RunFile } from "../src/export-pairs";

const node = (id: string, agentId: string, text: string, path: string) => ({
  _id: id,
  agentId,
  kind: "action" as const,
  verb: "EDIT",
  text,
  files: [path],
  touches: [{ path, op: "create" }],
  references: [],
  outcome: "open" as const,
  at: 1,
});

const row = (id: string, agents: string[], type: string, relation: string, withNodes = true) => ({
  id,
  type,
  relation,
  action: "warn",
  reason: "r",
  source: "rule" as const,
  agents,
  confidence: 0.9,
  evidence: ["R2: x", "retrieved: both mutate db/schema/users.ts"],
  nodeKind: "action" as const,
  nodeText: "EDIT db/schema/users.ts",
  againstText: "EDIT db/schema/users.ts",
  latencyMs: 0,
  at: 2,
  retrievalScore: 1,
  ...(withNodes
    ? {
        pair: {
          next: node("n1", agents[0] ?? "", "EDIT db/schema/users.ts", "db/schema/users.ts"),
          other: node("n2", agents[1] ?? "", "EDIT db/schema/users.ts", "db/schema/users.ts"),
          evidence: ["retrieved: both mutate db/schema/users.ts"],
        },
      }
    : {}),
});

const run = (over: Partial<RunFile>): RunFile => ({
  caseId: "dup-users-table",
  variant: "pointed",
  arm: "on",
  run: 1,
  code: "ev1",
  score: {
    control: false,
    expectations: [{ agents: ["noah", "joshua"], type: "duplicate", outcome: "hit", materialized: true }],
  },
  snapshot: { classifications: [] },
  ...over,
});

describe("pairsFromRun", () => {
  it("labels the expected pair gold-positive and any other pair gold-negative, like the scorer", () => {
    const { rows } = pairsFromRun(
      run({
        snapshot: {
          classifications: [
            row("hit", ["joshua", "noah"], "duplicate", "textual_conflict"),
            row("fp", ["joshua", "ash"], "conflict", "semantic_conflict"),
            row("normal", ["noah", "joshua"], "normal", "independent"),
          ],
        },
      }),
    );
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.hit?.gold).toEqual({ relation: "textual_conflict", origin: "eval" });
    expect(by.fp?.gold).toEqual({ relation: "overlap_compatible", origin: "eval" });
    expect(by.normal?.gold).toBeNull();
    expect(by.hit?.features).toHaveLength(FEATURE_NAMES.length);
    expect(by.hit?.rule?.ruleId).toBe("R2");
    expect(by.hit?.group).toBe("ev1");
  });

  it("keeps only teacher labels when the clash never happened, and skips off-arm and errored runs", () => {
    const unmaterialized = run({
      score: {
        control: false,
        expectations: [
          { agents: ["noah", "joshua"], type: "duplicate", outcome: "hit", materialized: false },
        ],
      },
      snapshot: { classifications: [row("x", ["noah", "joshua"], "duplicate", "duplicate")] },
    });
    expect(pairsFromRun(unmaterialized).rows[0]?.gold).toBeNull();
    expect(pairsFromRun(run({ arm: "off" })).rows).toEqual([]);
    expect(pairsFromRun(run({ error: "boom" })).rows).toEqual([]);
  });

  it("treats every row in a control as a negative, rebuilding nodes for old snapshots", () => {
    const control = run({
      score: { control: true, expectations: [] },
      snapshot: { classifications: [row("c", ["leo", "priya"], "conflict", "semantic_conflict", false)] },
    });
    const { rows, reconstructed } = pairsFromRun(control);
    expect(reconstructed).toBe(1);
    expect(rows[0]?.gold?.origin).toBe("eval");
    expect(rows[0]?.meta?.reconstructed).toBe(true);
  });
});

describe("nodeFromText", () => {
  it("reads verb, topic, files and failure from a compact signature", () => {
    const n = nodeFromText("i", "a", "LEARN api.cors: tried EDIT api.cors src/server.ts → FAIL");
    expect(n).toMatchObject({ kind: "knowledge", verb: "LEARN", outcome: "failed" });
    expect(n.touches.map((t) => t.path)).toEqual(["src/server.ts"]);
    expect(nodeFromText("j", "a", "EDIT auth.token src/auth/issue-token.ts").topic).toBe("auth.token");
  });
});

describe("exportPairs", () => {
  it("walks a results directory and writes pairs.jsonl", () => {
    const dir = mkdtempSync(join(tmpdir(), "lb-pairs-"));
    mkdirSync(join(dir, "runs", "a"), { recursive: true });
    writeFileSync(
      join(dir, "runs", "a", "run.json"),
      JSON.stringify(
        run({
          snapshot: { classifications: [row("hit", ["joshua", "noah"], "duplicate", "textual_conflict")] },
        }),
      ),
    );
    const s = exportPairs(dir);
    expect(s).toMatchObject({ runs: 1, rows: 1, gold: 1 });
    expect(readFileSync(join(dir, "pairs.jsonl"), "utf8").trim().split("\n")).toHaveLength(1);
  });
});
