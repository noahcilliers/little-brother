import { describe, expect, it } from "vitest";
import {
  r1LineOverlap,
  r2SameCreate,
  r4DeleteVsUse,
  r5SignatureChange,
  r6CreateVsReference,
  r7SameSymbol,
  r8DisjointRanges,
  r9GeneratedOnly,
  r10FailedSignature,
} from "../src/classify/rules/index";
import type { RuleResult } from "../src/classify/types";
import { node, pair } from "./classify-fixtures";

function verdict(r: RuleResult) {
  if (!r || !("judgment" in r)) throw new Error(`expected a judgment, got ${JSON.stringify(r)}`);
  return r.judgment;
}

describe("R1 line overlap", () => {
  const a = node({ agentId: "a", touches: [{ path: "src/x.ts", op: "write", lines: [10, 20] }] });
  it("settles overlapping ranges as textual_conflict", () => {
    const b = node({ agentId: "b", touches: [{ path: "src/x.ts", op: "write", lines: [15, 30] }] });
    const j = verdict(r1LineOverlap.check(pair(a, b)));
    expect(j.relation).toBe("textual_conflict");
    expect(j.confidence).toBe(0.95);
    expect(j.evidence[0]).toContain("src/x.ts");
  });
  it("ignores disjoint ranges, reads and failure memory", () => {
    const disjoint = node({ agentId: "b", touches: [{ path: "src/x.ts", op: "write", lines: [40, 50] }] });
    const read = node({ agentId: "b", touches: [{ path: "src/x.ts", op: "read", lines: [10, 20] }] });
    expect(r1LineOverlap.check(pair(a, disjoint))).toBeNull();
    expect(r1LineOverlap.check(pair(a, read))).toBeNull();
    const same = node({ agentId: "b", touches: [{ path: "src/x.ts", op: "write", lines: [10, 20] }] });
    expect(r1LineOverlap.check(pair(a, same, true))).toBeNull();
  });
});

describe("identical changes (compatible control)", () => {
  it("R1 and R2 do not fire when both sides made the identical edit", () => {
    const t = [{ path: "web/vite.config.ts", op: "write" as const, lines: [4, 5] as [number, number] }];
    const a = node({ signature: "same", touches: t });
    const b = node({ agentId: "b", signature: "same", touches: t });
    expect(r1LineOverlap.check(pair(a, b))).toMatchObject({ hint: { rule: "R1" } });
    const c = node({ agentId: "b", signature: "different", touches: t });
    expect(verdict(r1LineOverlap.check(pair(a, c))).relation).toBe("textual_conflict");
  });
});

describe("R2 same create", () => {
  it("settles two creates of the same path", () => {
    const a = node({ touches: [{ path: "db/schema/users.ts", op: "create" }] });
    const b = node({
      agentId: "b",
      touches: [{ path: "db/schema/users.ts", op: "create" }],
      references: ["src/contracts/user.ts::User", "node:crypto::createHash", "db/schema/users.ts::users"],
    });
    const j = verdict(r2SameCreate.check(pair(a, b)));
    expect(j.relation).toBe("textual_conflict");
    expect(j.type).toBe("duplicate");
    expect(j.evidence.slice(0, 2)).toEqual([
      "R2: db/schema/users.ts is already being created",
      "R2: import User from src/contracts/user.ts instead",
    ]);
  });
  it("settles two creates of the same symbol in different files", () => {
    const a = node({ touches: [{ path: "a.ts", symbol: "User", op: "create" }] });
    const b = node({ agentId: "b", touches: [{ path: "b.ts", symbol: "User", op: "create" }] });
    expect(verdict(r2SameCreate.check(pair(a, b))).relation).toBe("textual_conflict");
  });
  it("does not fire for create vs write", () => {
    const a = node({ touches: [{ path: "x.ts", op: "create" }] });
    const b = node({ agentId: "b", touches: [{ path: "x.ts", op: "write" }] });
    expect(r2SameCreate.check(pair(a, b))).toBeNull();
  });
});

describe("R4 delete/rename vs use", () => {
  it("other deletes what next references → new_needs_other", () => {
    const next = node({ references: ["src/auth/legacy.ts::login"] });
    const other = node({
      agentId: "b",
      touches: [{ path: "src/auth/legacy.ts", symbol: "src/auth/legacy.ts::login", op: "delete" }],
    });
    const j = verdict(r4DeleteVsUse.check(pair(next, other)));
    expect(j.relation).toBe("semantic_conflict");
    expect(j.direction).toBe("new_needs_other");
    expect(j.confidence).toBe(0.9);
  });
  it("next renames a file the other writes → other_needs_new", () => {
    const next = node({ touches: [{ path: "src/a.ts", op: "rename" }] });
    const other = node({ agentId: "b", touches: [{ path: "src/a.ts", op: "write" }] });
    const j = verdict(r4DeleteVsUse.check(pair(next, other)));
    expect(j.direction).toBe("other_needs_new");
  });
  it("matches a file-level delete against a path reference", () => {
    const next = node({ touches: [{ path: "src/util.ts", op: "delete" }] });
    const other = node({ agentId: "b", references: ["src/util.ts::fmt"] });
    expect(verdict(r4DeleteVsUse.check(pair(next, other))).relation).toBe("semantic_conflict");
  });
  it("is silent for unrelated work", () => {
    const next = node({ touches: [{ path: "src/a.ts", op: "delete" }] });
    const other = node({ agentId: "b", touches: [{ path: "src/b.ts", op: "write" }], references: ["c"] });
    expect(r4DeleteVsUse.check(pair(next, other))).toBeNull();
  });
});

describe("R5 signature change vs call", () => {
  it("next changes pay() that the other calls → semantic_conflict 0.85", () => {
    const next = node({
      touches: [{ path: "src/pay.ts", symbol: "src/pay.ts::pay", op: "signature_change" }],
    });
    const other = node({ agentId: "b", references: ["pay"] });
    const j = verdict(r5SignatureChange.check(pair(next, other)));
    expect(j.relation).toBe("semantic_conflict");
    expect(j.confidence).toBe(0.85);
    expect(j.direction).toBe("other_needs_new");
  });
  it("other changes a signature next calls → new_needs_other", () => {
    const next = node({ references: ["src/pay.ts::pay"] });
    const other = node({
      agentId: "b",
      touches: [{ path: "src/pay.ts", symbol: "src/pay.ts::pay", op: "signature_change" }],
    });
    expect(verdict(r5SignatureChange.check(pair(next, other))).direction).toBe("new_needs_other");
  });
  it("does not match same name in a different file", () => {
    const next = node({
      touches: [{ path: "src/pay.ts", symbol: "src/pay.ts::pay", op: "signature_change" }],
    });
    const other = node({ agentId: "b", references: ["src/other.ts::pay"] });
    expect(r5SignatureChange.check(pair(next, other))).toBeNull();
  });
});

describe("R6 create vs reference", () => {
  it("next uses User.role that the other is creating → ordering_dependency new_needs_other", () => {
    const next = node({ references: ["User.role"] });
    const other = node({
      agentId: "b",
      touches: [{ path: "src/contracts/user.ts", symbol: "src/contracts/user.ts::User", op: "create" }],
    });
    const j = verdict(r6CreateVsReference.check(pair(next, other)));
    expect(j.relation).toBe("ordering_dependency");
    expect(j.direction).toBe("new_needs_other");
    expect(j.confidence).toBe(0.8);
  });
  it("reverse direction when next creates what the other uses", () => {
    const next = node({ touches: [{ path: "u.ts", symbol: "u.ts::User", op: "create" }] });
    const other = node({ agentId: "b", references: ["User"] });
    expect(verdict(r6CreateVsReference.check(pair(next, other))).direction).toBe("other_needs_new");
  });
});

describe("R10 exact failed signature", () => {
  it("settles repeats_failure against a failed action", () => {
    const next = node({ signature: "h1" });
    const other = node({
      agentId: "b",
      signature: "h1",
      outcome: "failed",
      text: "EDIT api.cors src/server.ts → FAIL",
    });
    const j = verdict(r10FailedSignature.check(pair(next, other, true)));
    expect(j.relation).toBe("repeats_failure");
    expect(j.evidence[0]).toContain("api.cors");
  });
  it("settles against a knowledge node even when it later succeeded", () => {
    const next = node({ signature: "h1" });
    const other = node({ kind: "knowledge", signature: "h1", outcome: "succeeded" });
    expect(verdict(r10FailedSignature.check(pair(next, other, true))).relation).toBe("repeats_failure");
  });
  it("ignores matching signatures of open or succeeded actions, and missing signatures", () => {
    expect(
      r10FailedSignature.check(
        pair(node({ signature: "h" }), node({ signature: "h", outcome: "succeeded" })),
      ),
    ).toBeNull();
    expect(r10FailedSignature.check(pair(node(), node({ outcome: "failed" })))).toBeNull();
  });
});

describe("hints R7-R9", () => {
  it("R7: same symbol, lines unknown", () => {
    const a = node({ touches: [{ path: "x.ts", symbol: "x.ts::f", op: "write" }] });
    const b = node({ agentId: "b", touches: [{ path: "x.ts", symbol: "x.ts::f", op: "write" }] });
    expect(r7SameSymbol.check(pair(a, b))).toEqual({
      hint: { rule: "R7", text: expect.stringContaining("f") },
    });
  });
  it("R8: same file, disjoint ranges", () => {
    const a = node({ touches: [{ path: "x.ts", op: "write", lines: [1, 5] }] });
    const b = node({ agentId: "b", touches: [{ path: "x.ts", op: "write", lines: [50, 60] }] });
    expect(r8DisjointRanges.check(pair(a, b))).toMatchObject({ hint: { rule: "R8" } });
  });
  it("R9: only a generated file is shared", () => {
    const a = node({ touches: [{ path: "pnpm-lock.yaml", op: "write", generated: true }] });
    const b = node({ agentId: "b", touches: [{ path: "pnpm-lock.yaml", op: "write", generated: true }] });
    expect(r9GeneratedOnly.check(pair(a, b))).toMatchObject({ hint: { rule: "R9" } });
    expect(r2SameCreate.check(pair(a, b))).toBeNull();
  });
});
