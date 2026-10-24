import { describe, expect, it } from "vitest";
import { cleanPrompt, sessionCommand } from "./prompt-text";

describe("cleanPrompt", () => {
  it("unwraps pasted text and drops harness blocks", () => {
    const raw =
      '<pasted_content id="7c6e"> **Title**: Add resource limit </pasted_content>\n<system-reminder>ignore me</system-reminder> please';
    expect(cleanPrompt(raw)).toBe("Title: Add resource limit please");
  });

  it("returns empty for a notification-only prompt", () => {
    expect(cleanPrompt("<task-notification><summary>done</summary></task-notification>")).toBe("");
  });
});

describe("sessionCommand", () => {
  it("reads the typed slash command and the expanded marker", () => {
    expect(sessionCommand("/little-brother:join K7F2QX")).toEqual({ kind: "join", code: "k7f2qx" });
    expect(sessionCommand("lb:join auth-sprint\nReply in one line.")).toEqual({
      kind: "join",
      code: "auth-sprint",
    });
    expect(sessionCommand("/little-brother:leave")).toEqual({ kind: "leave" });
  });

  it("ignores ordinary prompts that mention joining", () => {
    expect(sessionCommand("join the tables in users.ts")).toBeNull();
  });
});
