import { describe, expect, it } from "vitest";
import { applyCollisionPolicy, resolveCollision, takeoverNotice } from "../src/classify/collision";
import { acceptComparison } from "../src/classify/compare";
import { decide } from "../src/classify/decide";
import { renderEvidence } from "../src/classify/evidence";
import { r1LineOverlap, r2SameCreate } from "../src/classify/rules/index";
import type { Judgment, Priority, RuleResult } from "../src/classify/types";
import { node, pair } from "./classify-fixtures";

const p = (over: Partial<Priority> = {}): Priority => ({
  owner: false,
  aligned: false,
  scopeFit: false,
  progress: 0,
  ...over,
});

function verdict(r: RuleResult) {
  if (!r || !("judgment" in r)) throw new Error(`expected a judgment, got ${JSON.stringify(r)}`);
  return r.judgment;
}

describe("resolveCollision", () => {
  it("compares owner > aligned > scopeFit > progress", () => {
    expect(resolveCollision(p({ owner: true }), p({ aligned: true, scopeFit: true, progress: 9 }))).toBe(
      "next",
    );
    expect(resolveCollision(p({ aligned: true }), p({ scopeFit: true, progress: 9 }))).toBe("next");
    expect(resolveCollision(p({ progress: 9 }), p({ scopeFit: true }))).toBe("other");
    expect(resolveCollision(p({ owner: true }), p({ owner: true, aligned: true }))).toBe("other");
  });
  it("counts progress only when the gap is at least 2", () => {
    expect(resolveCollision(p({ progress: 3 }), p({ progress: 1 }))).toBe("next");
    expect(resolveCollision(p({ progress: 1 }), p({ progress: 3 }))).toBe("other");
    expect(resolveCollision(p({ progress: 2 }), p({ progress: 1 }))).toBe("tie");
    expect(resolveCollision(p(), p())).toBe("tie");
  });
});

describe("collision policy in decide", () => {
  const usersCreate = (agentId: string, priority?: Priority) =>
    node({
      agentId,
      topic: "db.users",
      touches: [
        { path: "db/schema/users.ts", op: "create", lines: [1, 30] },
        { path: "db/schema/users.ts", symbol: "db/schema/users.ts::findUserByEmail", op: "create" },
      ],
      ...(priority ? { priority } : {}),
    });
  const decideR2 = (next: ReturnType<typeof usersCreate>, other: ReturnType<typeof usersCreate>) => {
    const pr = pair(next, other);
    return decide(verdict(r2SameCreate.check(pr)), pr, { nextKind: "action" });
  };

  it("a stronger newcomer takes over: its action passes and it is named the winner", () => {
    const j = decideR2(usersCreate("noah", p({ owner: true })), usersCreate("joshua", p({ progress: 5 })));
    expect(j).toMatchObject({ action: "ignore", winner: "next", relation: "textual_conflict" });
    expect(j.evidence[1]).toBe("claim: owns db.users");
  });
  it("the existing owner's claim holds and the deny names why", () => {
    const j = decideR2(usersCreate("joshua", p()), usersCreate("noah", p({ owner: true })));
    expect(j).toMatchObject({ action: "serialize", winner: "other" });
    const text = renderEvidence([j], () => ({ name: "noah", active: true, text: "EDIT db.users" }));
    expect(text).toContain("noah owns db.users");
  });
  it("a tie keeps the first claim", () => {
    const j = decideR2(usersCreate("b", p({ progress: 1 })), usersCreate("a", p()));
    expect(j).toMatchObject({ action: "serialize", winner: "other" });
    expect(j.evidence).toContain("claim: claimed it first");
  });
  it("without priorities, behaves as before (first holds)", () => {
    const j = decideR2(usersCreate("b"), usersCreate("a"));
    expect(j).toMatchObject({ action: "serialize", winner: "other" });
    expect(j.evidence.some((e) => e.startsWith("claim:"))).toBe(false);
  });
  it("escalations are not settled by claim strength", () => {
    const j: Judgment = {
      otherNodeId: "x",
      relation: "semantic_conflict",
      direction: "none",
      confidence: 0.9,
      evidence: ["R4: x"],
      action: "block",
      source: "rule",
      retrievalScore: 1,
      latencyMs: 0,
    };
    const out = applyCollisionPolicy(j, {
      next: usersCreate("n", p({ owner: true })),
      other: usersCreate("o", p()),
    });
    expect(out).toBe(j);
  });
  it("takeover notice tells the loser who owns it and what to build on", () => {
    const winner = usersCreate("noah", p({ owner: true }));
    const loser = usersCreate("joshua", p());
    const j = decideR2(winner, loser);
    const text = takeoverNotice(j, winner, loser, "noah");
    expect(text).toContain("noah owns db.users and is taking over db/schema/users.ts; stop editing it");
    expect(text).toContain("use findUserByEmail from db/schema/users.ts");
  });
});

describe("R1 base commits and landed work", () => {
  const a = node({
    agentId: "a",
    baseRev: "aaa",
    touches: [{ path: "src/x.ts", op: "write", lines: [10, 20] }],
  });
  it("different base commits downgrade R1 to a warning", () => {
    const b = node({
      agentId: "b",
      baseRev: "bbb",
      touches: [{ path: "src/x.ts", op: "write", lines: [15, 30] }],
    });
    const v = verdict(r1LineOverlap.check(pair(a, b)));
    expect(v.confidence).toBe(0.6);
    expect(v.evidence).toContain("R1: different base commits; line ranges may not align");
    expect(decide(v, pair(a, b), { nextKind: "action" }).action).toBe("warn");
  });
  it("same or unknown base settles as before", () => {
    const same = node({
      agentId: "b",
      baseRev: "aaa",
      touches: [{ path: "src/x.ts", op: "write", lines: [15, 30] }],
    });
    const unknown = node({ agentId: "b", touches: [{ path: "src/x.ts", op: "write", lines: [15, 30] }] });
    expect(verdict(r1LineOverlap.check(pair(a, same))).confidence).toBe(0.95);
    expect(verdict(r1LineOverlap.check(pair(a, unknown))).confidence).toBe(0.95);
  });
  it("pushed or merged work no longer collides; committed still does", () => {
    const touches = [{ path: "src/x.ts", op: "create" as const, lines: [1, 5] as [number, number] }];
    const next = node({ agentId: "a", touches });
    for (const landed of ["pushed", "merged"] as const) {
      const other = node({ agentId: "b", landed, touches: [{ ...touches[0], lines: [1, 9] }] });
      expect(r1LineOverlap.check(pair(next, other))).toBeNull();
      expect(r2SameCreate.check(pair(next, other))).toBeNull();
    }
    const committed = node({
      agentId: "b",
      landed: "committed",
      touches: [{ ...touches[0], lines: [1, 9] }],
    });
    expect(verdict(r2SameCreate.check(pair(next, committed))).relation).toBe("textual_conflict");
  });
});

describe("acceptComparison", () => {
  it("keeps at most six non-empty lines and drops empty output", () => {
    expect(acceptComparison("a\n\nb\nc\nd\ne\nf\ng")).toBe("a\nb\nc\nd\ne\nf");
    expect(acceptComparison("  \n")).toBeNull();
    expect(acceptComparison(null)).toBeNull();
  });
});
