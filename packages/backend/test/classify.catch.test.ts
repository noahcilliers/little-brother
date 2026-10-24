import type { IngestEnvelope } from "@lb/core";
import { describe, expect, test } from "vitest";
import { envelope, hook, joinMember, makeT, type T } from "./platformHelpers";

// One coordination event = one row and one notice, however many times the same work re-triggers it.

const create = (path: string, toolUseId: string, column = "email"): Partial<IngestEnvelope> => ({
  tool: "Write",
  toolUseId,
  files: [path],
  touches: [{ path, op: "create", symbol: "users" }],
  preview: `+export const users = table('users', {\n+  id: text(),\n+  ${column}: text(),`,
});

async function rows(t: T) {
  return t.run(async (ctx) => {
    const all = await ctx.db.query("classifications").collect();
    return all.filter((c) => c.type !== "normal");
  });
}

describe("catches", () => {
  test("a retried duplicate edit is denied each time but stored and announced once", async () => {
    const t = makeT();
    const noah = await joinMember(t, "noah");
    const josh = await joinMember(t, "joshua");
    await hook(t, noah, envelope("UserPromptSubmit", "n1", { prompt: "add the users table" }));
    await hook(t, noah, envelope("PreToolUse", "n1", create("db/schema/users.ts", "n-w1")));
    await hook(t, noah, envelope("PostToolUse", "n1", create("db/schema/users.ts", "n-w1")));

    await hook(t, josh, envelope("UserPromptSubmit", "j1", { prompt: "checkout needs a users table" }));
    const first = await hook(
      t,
      josh,
      envelope("PreToolUse", "j1", create("db/schema/users.ts", "j-w1", "name")),
    );
    const again = await hook(
      t,
      josh,
      envelope("PreToolUse", "j1", create("db/schema/users.ts", "j-w2", "name")),
    );

    for (const r of [first, again]) {
      const text = JSON.stringify(r.output);
      expect(text).toContain("deny");
      expect(text).toContain("db/schema/users.ts");
      expect(text).toContain("open their branch");
    }
    const caught = await rows(t);
    expect(caught).toHaveLength(1);
    const notices = await t.run((ctx) => ctx.db.query("inbox").collect());
    // The owner of a redirected duplicate isn't interrupted at all; nobody is told twice.
    expect(notices.filter((n) => n.classificationId === caught[0]?._id).length).toBeLessThanOrEqual(1);
  });
});
