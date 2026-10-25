import { describe, expect, test } from "vitest";
import { envelope, hook, joinMember, makeT } from "./platformHelpers";

const at = (session: string, cwd: string, machine = "mbp") => {
  const e = envelope("SessionStart", session);
  e.session.cwd = cwd;
  e.session.machine = machine;
  return e;
};

describe("two Claude sessions in one folder", () => {
  test("the newcomer is told to use its own copy; other machines or folders are fine", async () => {
    const t = makeT();
    const noah = await joinMember(t, "noah");
    const ash = await joinMember(t, "ash");
    await hook(t, noah, at("n1", "/Users/me/shop"));
    const same = await hook(t, ash, at("a1", "/Users/me/shop/web"));
    expect(JSON.stringify(same.output)).toContain("same folder");
    const elsewhere = await hook(t, ash, at("a2", "/Users/me/shop-2"));
    expect(JSON.stringify(elsewhere.output)).not.toContain("same folder");
    const otherMachine = await hook(t, ash, at("a3", "/Users/me/shop", "air"));
    expect(JSON.stringify(otherMachine.output)).not.toContain("same folder");
  });
});
