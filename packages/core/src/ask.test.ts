import { describe, expect, it } from "vitest";
import { AskInput, askReply } from "./ask";

describe("askReply", () => {
  it("lists every answer, including free text", () => {
    const text = askReply([
      { question: "Where?", selected: ["New dir"] },
      { question: "Stack?", selected: [], other: "Next.js + Express" },
    ]);
    expect(text).toContain("- Where? → New dir");
    expect(text).toContain("- Stack? → Next.js + Express");
    expect(text).toContain("don't ask again");
  });

  it("parses the tool input Claude Code sends", () => {
    const parsed = AskInput.parse({
      questions: [{ question: "Q?", header: "Scope", options: [{ label: "A" }] }],
    });
    expect(parsed.questions[0]?.options[0]?.label).toBe("A");
  });
});
