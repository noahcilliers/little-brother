import { describe, expect, it } from "vitest";
import { catchKey, contractCard, goalAnchor, interventionAction } from "./catch";

describe("catch identity", () => {
  it("every step of a goal shares one key with the other side, in either order", () => {
    const plan = { _id: "g1", kind: "intent" };
    const edit1 = { _id: "a1", kind: "action", parentId: "g1" };
    const edit2 = { _id: "a2", kind: "action", parentId: "g1" };
    const theirs = { _id: "a9", kind: "action", parentId: "g2" };
    expect(goalAnchor(edit1)).toBe("g1");
    expect(catchKey(edit1, theirs)).toBe(catchKey(theirs, edit2));
    expect(catchKey(plan, theirs)).toBe(catchKey(edit1, theirs));
  });
});

describe("interventionAction", () => {
  it("keeps a denial when the avoided work pays for it, downgrades a cheap one to a hint", () => {
    const base = { relation: "duplicate" as const, action: "serialize" as const, confidence: 0.9 };
    expect(interventionAction({ ...base, avoidedTokens: 12_000 })).toBe("serialize");
    expect(interventionAction({ ...base, avoidedTokens: 1_500 })).toBe("warn");
    expect(interventionAction(base)).toBe("serialize");
  });

  it("never downgrades correctness conflicts", () => {
    expect(
      interventionAction({
        relation: "semantic_conflict",
        action: "serialize",
        confidence: 0.9,
        avoidedTokens: 10,
      }),
    ).toBe("serialize");
  });
});

describe("contractCard", () => {
  it("names the files, exported symbols and the head of the diff", () => {
    const card = contractCard({
      files: ["db/schema/users.ts"],
      touches: [{ path: "db/schema/users.ts", symbol: "users", op: "create" }],
      preview:
        "@@ -0,0 +1,4 @@\n+import { table } from './t'\n+export const users = table('users', {\n+  id: text(),\n+  email: text(),",
    });
    expect(card).toContain("db/schema/users.ts");
    expect(card).toContain("exports users");
    expect(card).toContain("export const users = table('users', {");
  });
});

describe("contract card for a rename", () => {
  it("names the rename and never lists the old name or removed lines as current", () => {
    const card = contractCard({
      files: ["django/utils/http.py"],
      touches: [
        { path: "django/utils/http.py", op: "write" },
        { path: "django/utils/http.py", symbol: "django/utils/http.py::base36_to_int", op: "rename" },
        { path: "django/utils/http.py", symbol: "django/utils/http.py::decode_base36", op: "create" },
      ],
      preview: "-def base36_to_int(s):\n+def decode_base36(s):",
    });
    expect(card).toContain("renamed base36_to_int → decode_base36");
    expect(card).toContain("def decode_base36(s):");
    expect(card).not.toContain("def base36_to_int");
    expect(card).not.toMatch(/exports[^·]*base36_to_int/);
  });
});

describe("interface changes", () => {
  it("deny the first edit against the old interface with the new one, then let the agent continue", () => {
    const j = { relation: "semantic_conflict" as const, action: "block" as const, confidence: 0.9 };
    expect(interventionAction({ ...j, evidence: ["R5: issueToken(user) now takes (user, ttl)"] })).toBe(
      "warn",
    );
    expect(interventionAction({ ...j, evidence: ["judge: incompatible auth"] })).toBe("block");
  });
});
