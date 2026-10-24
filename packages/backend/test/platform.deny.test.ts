import type { Judgment } from "@lb/core";
import { expect, test } from "vitest";
import { renderDenial } from "../convex/hooks/pre";

const j = (action: Judgment["action"], relation: Judgment["relation"], evidence: string): Judgment => ({
  otherNodeId: "n",
  relation,
  direction: "none",
  confidence: 0.9,
  evidence: [evidence],
  action,
  source: "rule",
  retrievalScore: 1,
  latencyMs: 1,
});

test("only serialize/block judgments deny, worst first", () => {
  expect(renderDenial([j("warn", "repeats_failure", "cors failed")])).toBeNull();
  const reason = renderDenial([
    j("serialize", "textual_conflict", "both create users.ts"),
    j("block", "intent_contradiction", "jwt vs cookie"),
  ]);
  expect(reason).toBe("[little-brother] conflict · jwt vs cookie\nconflict · both create users.ts");
});
