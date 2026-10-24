import { describe, expect, it } from "vitest";
import { type OpenConflict, topicCovers, topicGate } from "../src/classify/topic-gate";
import { TopicMap } from "../src/topics";
import { node } from "./classify-fixtures";

const map = TopicMap.parse({
  topics: {
    "auth.mechanism": {
      owner: "noah",
      files: ["src/auth/**"],
      consumers: ["src/checkout/**", "web/src/api.ts"],
    },
    "api.cart.shape": { owner: "joshua", files: ["src/checkout/cart.ts", "src/checkout/routes.ts"] },
  },
});
const handles: Record<string, string> = { jA: "joshua", nA: "noah", aA: "ash" };
const conflict: OpenConflict = {
  classificationId: "c1",
  relation: "intent_contradiction",
  confidence: 0.86,
  topics: ["auth.mechanism"],
  agentIds: ["nA", "jA"],
  otherNodeFor: { nA: "n19", jA: "n21" },
  reason: "[little-brother] conflict · jwt.sign bearer vs req.session.userId",
};

describe("topicGate", () => {
  it("globs cover files and consumers", () => {
    expect(topicCovers(map, "auth.mechanism", "src/checkout/routes.ts")).toBe(true);
    expect(topicCovers(map, "auth.mechanism", "web/src/api.ts")).toBe(true);
    expect(topicCovers(map, "auth.mechanism", "web/src/app.ts")).toBe(false);
  });
  it("blocks the non-owner side editing a consumer of the contested topic", () => {
    const edit = node({ agentId: "jA", touches: [{ path: "src/checkout/routes.ts", op: "write" }] });
    const [j] = topicGate(edit, [conflict], map, (id) => handles[id]);
    expect(j).toMatchObject({ action: "block", otherNodeId: "n21", type: "conflict" });
    expect(j?.evidence[0]).toBe(
      "auth.mechanism conflict open, owner noah decides; src/checkout/routes.ts is on that topic",
    );
    expect(j?.evidence[1]).toBe("jwt.sign bearer vs req.session.userId");
  });
  it("lets the owner, uninvolved agents, reads, and unrelated files through", () => {
    const owner = node({ agentId: "nA", touches: [{ path: "src/auth/issue-token.ts", op: "write" }] });
    const bystander = node({ agentId: "aA", touches: [{ path: "src/checkout/routes.ts", op: "write" }] });
    const read = node({ agentId: "jA", touches: [{ path: "src/checkout/routes.ts", op: "read" }] });
    const elsewhere = node({ agentId: "jA", touches: [{ path: "web/src/app.ts", op: "write" }] });
    for (const n of [owner, bystander, read, elsewhere]) {
      expect(topicGate(n, [conflict], map, (id) => handles[id])).toEqual([]);
    }
  });
});
