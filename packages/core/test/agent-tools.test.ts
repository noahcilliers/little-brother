import { describe, expect, it } from "vitest";
import { textToolCalls } from "../src/agent/text-tool-calls";
import { parseToolArgs, TOOL_SCHEMAS } from "../src/agent/tools";

describe("parseToolArgs", () => {
  it("accepts Claude Code's shapes unchanged", () => {
    const r = parseToolArgs("Edit", { file_path: "a.ts", old_string: "x", new_string: "y" });
    expect(r).toEqual({ ok: true, input: { file_path: "a.ts", old_string: "x", new_string: "y" } });
  });

  it("maps other agents' field names onto Claude Code's", () => {
    const r = parseToolArgs("Edit", { path: "a.ts", old_str: "x", new_str: "y", replaceAll: "true" });
    expect(r).toEqual({
      ok: true,
      input: { file_path: "a.ts", old_string: "x", new_string: "y", replace_all: true },
    });
    expect(parseToolArgs("Read", { file_path: "a.ts", offset: "10" })).toEqual({
      ok: true,
      input: { file_path: "a.ts", offset: 10 },
    });
  });

  it("parses JSON-string arguments and reports bad ones as text the model can act on", () => {
    expect(parseToolArgs("Bash", '{"command":"ls"}')).toEqual({ ok: true, input: { command: "ls" } });
    const bad = parseToolArgs("Bash", '{"command": ');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/not valid JSON/);
    const missing = parseToolArgs("Write", { file_path: "a.ts" });
    if (!missing.ok) expect(missing.error).toMatch(/content/);
    else throw new Error("expected an error");
  });

  it("rejects unknown tools by listing the real ones", () => {
    const r = parseToolArgs("str_replace", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Read, Write, Edit, Bash, Glob, Grep/);
  });

  it("declares a schema for every tool it parses", () => {
    expect(TOOL_SCHEMAS.map((t) => t.name)).toEqual(["Read", "Write", "Edit", "Bash", "Glob", "Grep"]);
  });
});

describe("textToolCalls", () => {
  const known = new Set(["Read", "Bash"]);

  it("recovers tagged, fenced and bare calls", () => {
    expect(
      textToolCalls('<tool_call>{"name":"Read","arguments":{"file_path":"a"}}</tool_call>', known, "t"),
    ).toEqual([{ id: "t_0", name: "Read", args: { file_path: "a" } }]);
    const fenced = 'Let me look.\n```json\n{"name": "Bash", "parameters": {"command": "ls"}}\n```';
    expect(textToolCalls(fenced, known, "t")).toEqual([{ id: "t_0", name: "Bash", args: { command: "ls" } }]);
    expect(textToolCalls('{"function":{"name":"Read","arguments":"{}"}}', known, "t")).toHaveLength(1);
  });

  it("leaves prose and unknown names alone", () => {
    expect(textToolCalls("Done. The config is {debug: true}.", known, "t")).toEqual([]);
    expect(textToolCalls('{"name":"Deploy","arguments":{}}', known, "t")).toEqual([]);
  });
});
