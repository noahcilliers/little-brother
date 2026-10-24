import { describe, expect, it } from "vitest";
import { acceptDistilled, distillTrajectory, type TrajectoryStep } from "../src/classify/distill";
import { judgePrompt, parseJudgeOutput } from "../src/classify/judge-prompt";
import { toClassifiedNode } from "../src/classify/view";
import { node, pair } from "./classify-fixtures";

const step = (p: Partial<TrajectoryStep>): TrajectoryStep => ({
  verb: "EDIT",
  text: "EDIT",
  outcome: "succeeded",
  files: [],
  at: 0,
  ...p,
});

describe("distillTrajectory", () => {
  const intent = step({
    verb: "PLAN",
    text: "PLAN api.cors add CORS",
    topic: "api.cors",
    files: ["src/server.ts"],
    outcome: "open",
  });
  it("returns null when nothing failed", () => {
    expect(distillTrajectory(intent, [step({ at: 1 })])).toBeNull();
  });
  it("records a failure with no recovery, keyed by the tried change", () => {
    const l = distillTrajectory(intent, [
      step({
        text: "EDIT api.cors src/server.ts cors(origin:*)",
        signature: "sig-edit",
        topic: "api.cors",
        files: ["src/server.ts"],
        at: 1,
      }),
      step({ verb: "TEST", text: "TEST npm test → FAIL", outcome: "failed", signature: "sig-test", at: 2 }),
      step({ verb: "TEST", text: "TEST npm test → FAIL", outcome: "failed", signature: "sig-test", at: 3 }),
    ]);
    expect(l).toMatchObject({
      outcome: "failed",
      signature: "sig-edit",
      topic: "api.cors",
      files: ["src/server.ts"],
    });
    expect(l?.text).toBe(
      "LEARN api.cors: tried EDIT api.cors src/server.ts cors(origin:*) (2 failures) → FAIL",
    );
  });
  it("demo trajectory: wildcard CORS fails, the Vite proxy works", () => {
    const output =
      "Exit code 1\n\n> vitest run test/unit\n ❯ test/unit/storefront-access.test.ts (1 test | 1 failed)\n   × storefront can reach the API\n     → browsers reject Access-Control-Allow-Origin: * when credentials are allowed: expected '*' not to be '*'";
    const l = distillTrajectory(intent, [
      step({ text: "EDIT db.users db/schema/users.ts", files: ["db/schema/users.ts"], at: 1 }),
      step({
        text: "EDIT api.cors src/server.ts",
        signature: "cors",
        topic: "api.cors",
        files: ["src/server.ts"],
        at: 2,
      }),
      step({ verb: "TEST", text: "TEST npm test → FAIL", outcome: "failed", output, at: 3 }),
      step({ verb: "REVERT", text: "REVERT api.cors src/server.ts", files: ["src/server.ts"], at: 4 }),
      step({ verb: "FIX", text: "FIX api.cors web/vite.config.ts", files: ["web/vite.config.ts"], at: 5 }),
      step({ verb: "TEST", text: "TEST npm test → OK", at: 6 }),
    ]);
    expect(l).toMatchObject({
      outcome: "succeeded",
      signature: "cors",
      files: ["src/server.ts", "web/vite.config.ts"],
    });
    expect(l?.text).toBe(
      "LEARN api.cors: tried EDIT api.cors src/server.ts → FAIL: browsers reject Access-Control-Allow-Origin: * when credentials are allowed → worked: FIX api.cors web/vite.config.ts",
    );
  });
  it("accepts a short LLM rewrite and rejects junk", () => {
    const l = distillTrajectory(intent, [step({ outcome: "failed", at: 1 })]);
    if (!l) throw new Error("expected lesson");
    expect(
      acceptDistilled("tried cors(*) → failed because browsers reject creds → worked: vite proxy", l),
    ).toBe("LEARN api.cors: tried cors(*) → FAIL because browsers reject creds → worked: vite proxy");
    expect(acceptDistilled(null, l)).toBe(l.text);
    expect(acceptDistilled("used a proxy and it was fine", l)).toBe(l.text);
    expect(acceptDistilled("x".repeat(400), l)).toBe(l.text);
  });
});

describe("judge prompt and output parsing", () => {
  const p = pair(node({ text: "PLAN auth jwt" }), node({ agentId: "b", text: "PLAN auth cookies" }));
  it("builds a packet with both signatures and examples", () => {
    const s = judgePrompt(
      p,
      [{ rule: "R7", text: "both mutate f" }],
      ["NEW a vs OTHER b → duplicate (confirmed)"],
    );
    expect(s).toContain("PLAN auth jwt");
    expect(s).toContain("PLAN auth cookies");
    expect(s).toContain("R7 both mutate f");
    expect(s).toContain("duplicate (confirmed)");
  });
  it("parses valid output, including fenced JSON", () => {
    const raw =
      '```json\n{"relation":"intent_contradiction","direction":"none","confidence":0.83,"rationale":"jwt vs cookies"}\n```';
    expect(parseJudgeOutput(raw, p, [])).toMatchObject({
      relation: "intent_contradiction",
      confidence: 0.83,
      source: "llm",
    });
  });
  it("rejects invalid output", () => {
    expect(parseJudgeOutput("not json", p, [])).toBeNull();
    expect(
      parseJudgeOutput('{"relation":"maybe","direction":"none","confidence":0.5,"rationale":"x"}', p, []),
    ).toBeNull();
    expect(
      parseJudgeOutput('{"relation":"duplicate","direction":"none","confidence":2,"rationale":"x"}', p, []),
    ).toBeNull();
  });
});

describe("toClassifiedNode", () => {
  it("normalizes stored touches and adds file-level touches", () => {
    const n = toClassifiedNode({
      _id: "n1",
      agentId: "a",
      kind: "intent",
      verb: "PLAN",
      text: "PLAN",
      files: ["a.ts", "b.ts"],
      touches: [{ path: "a.ts", op: "weird", lines: [1, 2] }],
      references: [],
      outcome: "open",
      at: 1,
    });
    expect(n.touches).toEqual([
      { path: "a.ts", op: "write", lines: [1, 2] },
      { path: "b.ts", op: "write" },
    ]);
  });
});

describe("lexicalSimilarity", () => {
  it("relates a CORS prompt to the CORS lesson and not to unrelated work", async () => {
    const { lexicalSimilarity } = await import("../src/classify/lexical");
    const lesson =
      "LEARN api.cors: tried EDIT api.cors src/server.ts → FAIL: browsers reject Access-Control-Allow-Origin: * when credentials are allowed → worked: FIX api.cors web/vite.config.ts";
    const prompt = "PLAN add CORS middleware to the API so the storefront can call it";
    expect(lexicalSimilarity(prompt, lesson)).toBeGreaterThan(0.3);
    expect(lexicalSimilarity(prompt, "EDIT db.users db/schema/users.ts")).toBe(0);
  });
});
