import { describe, expect, it } from "vitest";
import { parseInvite } from "./invite";

describe("parseInvite", () => {
  it("reads links and bare codes", () => {
    expect(parseInvite("https://lb.app/start?invite=ab12cd&x=1")).toBe("ab12cd");
    expect(parseInvite("https://lb.app/app/invite/ab12cd")).toBe("ab12cd");
    expect(parseInvite("  ab12cd ")).toBe("ab12cd");
    expect(parseInvite("not a code")).toBeNull();
  });
});
