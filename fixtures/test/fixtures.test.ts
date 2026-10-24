import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HookInput } from "../../packages/core/src/hooks";
import { McpArgs } from "../../packages/core/src/mcp";

const AGENTS = ["noah", "joshua", "ash", "maya", "leo", "priya"];
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
    for (const line of scenario) expect(AGENTS).toContain(line.as);
  });

  it("starts all six sessions within one second and runs 60–90 s", () => {
    let t = 0;
    const at = scenario.map((l) => (t += Number(l.delayMs)));
    const starts = scenario.flatMap((l, i) =>
      (l.input as { hook_event_name?: string } | undefined)?.hook_event_name === "SessionStart" ? [at[i] ?? 0] : [],
    );
    expect(starts).toHaveLength(AGENTS.length);
    expect(Math.max(...starts)).toBeLessThan(1000);
    expect(t).toBeGreaterThanOrEqual(60_000);
    expect(t).toBeLessThanOrEqual(90_000);
  });

  it.each(AGENTS)("%s keeps a task list of at least three tasks, plus routine reads", (as) => {
    const mine = scenario.filter((l) => l.as === as);
    const hook = (l: Record<string, unknown>) => (l.input as { hook_event_name?: string } | undefined)?.hook_event_name;
    const tool = (l: Record<string, unknown>) => (l.input as { tool_name?: string } | undefined)?.tool_name;
    expect(mine.filter((l) => hook(l) === "TaskCreated").length).toBeGreaterThanOrEqual(3);
    expect(mine.filter((l) => tool(l) === "Read").length).toBeGreaterThanOrEqual(1);
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
