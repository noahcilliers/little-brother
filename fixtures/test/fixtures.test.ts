import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HookInput } from "../../packages/core/src/hooks";
import { McpArgs } from "../../packages/core/src/mcp";

const dir = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const hookFiles = readdirSync(dir("hooks")).filter((f) => f.endsWith(".json"));
const scenario = readFileSync(dir("scenario.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line) as Record<string, unknown>);

describe("fixtures/hooks", () => {
  it("has one payload per hook event", () => {
    const events = hookFiles.map((f) => JSON.parse(readFileSync(dir(`hooks/${f}`), "utf8")).hook_event_name);
    expect(new Set(events)).toEqual(
      new Set([
        "SessionStart",
        "UserPromptSubmit",
        "PreToolUse",
        "PostToolUse",
        "PostToolUseFailure",
        "Stop",
        "SessionEnd",
        "TaskCreated",
        "TaskCompleted",
      ]),
    );
  });

  it.each(hookFiles)("%s parses as HookInput", (file) => {
    const raw = JSON.parse(readFileSync(dir(`hooks/${file}`), "utf8"));
    expect(HookInput.safeParse(raw).error).toBeUndefined();
  });
});

describe("fixtures/scenario.jsonl", () => {
  it("has unique step ids and known agents", () => {
    expect(new Set(scenario.map((l) => l.step)).size).toBe(scenario.length);
    for (const line of scenario) expect(["noah", "joshua", "ash"]).toContain(line.as);
  });

  it.each(scenario.map((l) => [l.step, l] as const))("%s is a valid line", (_step, line) => {
    expect(line.delayMs).toBeTypeOf("number");
    if ("mcp" in line) {
      const schema = McpArgs[line.mcp as keyof typeof McpArgs];
      expect(schema, `unknown MCP tool ${String(line.mcp)}`).toBeDefined();
      expect(schema.safeParse(line.args).error).toBeUndefined();
      return;
    }
    const parsed = HookInput.parse(line.input);
    expect(parsed.cwd).toBe(line.cwd);
    const filePath = (line.input as { tool_input?: { file_path?: unknown } }).tool_input?.file_path;
    if (typeof filePath === "string") expect(filePath.startsWith(`${line.cwd}/`)).toBe(true);
  });
});
