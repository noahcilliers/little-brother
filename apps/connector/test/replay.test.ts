import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HookInput } from "@lb/core";
import { describe, expect, it } from "vitest";
import { describeOutput, parseReplay } from "../src/commands/replay-parse";

describe("parseReplay", () => {
  it("parses lines, skips blanks and comments, reports bad lines", () => {
    const text = [
      JSON.stringify({
        as: "noah",
        delayMs: 10,
        cwd: "/tmp/a",
        input: { hook_event_name: "UserPromptSubmit", session_id: "s", cwd: "/x", prompt: "p" },
      }),
      "",
      "// comment",
      "{bad",
      JSON.stringify({ input: { hook_event_name: "Stop" } }),
      JSON.stringify({ as: "ash", input: { hook_event_name: "Stop", session_id: "s2", cwd: "/y" } }),
    ].join("\n");
    const r = parseReplay(text);
    expect(r.lines.map((l) => l.as)).toEqual(["noah", "ash"]);
    expect(r.lines[0]).toMatchObject({ delayMs: 10, cwd: "/tmp/a" });
    expect(r.errors.map((e) => e.line)).toEqual([4, 5]);
  });

  it("parses MCP lines and rejects unknown tools", () => {
    const r = parseReplay(
      [
        JSON.stringify({
          step: "23-noah-decision",
          as: "noah",
          mcp: "post_decision",
          args: { topic: "t", value: "v", rationale: "r" },
        }),
        JSON.stringify({ as: "noah", mcp: "rm_rf", args: {} }),
      ].join("\n"),
    );
    expect(r.lines).toEqual([expect.objectContaining({ step: "23-noah-decision", mcp: "post_decision" })]);
    expect(r.errors.map((e) => e.line)).toEqual([2]);
  });

  it("parses the real demo scenario", () => {
    const text = readFileSync(join(__dirname, "../../../fixtures/scenario.jsonl"), "utf8");
    const r = parseReplay(text);
    expect(r.errors).toEqual([]);
    expect(r.lines).toHaveLength(43);
    expect(new Set(r.lines.map((l) => l.as))).toEqual(new Set(["noah", "joshua", "ash"]));
    const steps = r.lines.map((l) => l.step);
    expect(steps).toContain("14-joshua-users.pre");
    expect(steps).not.toContain("14-joshua-users.post");
    const mcp = r.lines.filter((l) => "mcp" in l);
    expect(mcp).toEqual([expect.objectContaining({ step: "23-noah-decision", mcp: "post_decision" })]);
    for (const l of r.lines) if ("input" in l) expect(HookInput.safeParse(l.input).success).toBe(true);
  });
});

describe("describeOutput", () => {
  it("summarises each hook output shape", () => {
    expect(describeOutput(null, false)).toMatch(/offline/);
    expect(describeOutput(null, true)).toBe("silent");
    expect(
      describeOutput(
        {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: "[little-brother] duplicate",
          },
        },
        true,
      ),
    ).toBe("DENY: duplicate");
    expect(
      describeOutput(
        {
          hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: "[little-brother]\n- cors failed",
          },
        },
        true,
      ),
    ).toBe("CONTEXT: - cors failed");
    expect(describeOutput({ decision: "block", reason: "ack c_12" }, true)).toBe("BLOCK STOP: ack c_12");
  });
});
