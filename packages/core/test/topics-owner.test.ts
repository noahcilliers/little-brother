import { describe, expect, it } from "vitest";
import { ownerMatches } from "../src/topics";

describe("ownerMatches", () => {
  const noah = { handle: "noahcilliers", name: "Noah Cilliers" };
  it("matches how teams actually write owners", () => {
    expect(ownerMatches("noah", noah)).toBe(true);
    expect(ownerMatches("@noahcilliers", noah)).toBe(true);
    expect(ownerMatches("Noah Cilliers", noah)).toBe(true);
    expect(ownerMatches("joshua", { handle: "justjayt", name: "Joshua T" })).toBe(true);
  });
  it("doesn't match strangers or tiny prefixes", () => {
    expect(ownerMatches("ash", noah)).toBe(false);
    expect(ownerMatches("no", noah)).toBe(false);
  });
});
