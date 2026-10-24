import { HookInput, IngestEnvelope } from "@lb/core";
import { describe, expect, it } from "vitest";
import { buildEnvelope } from "../src/hook/envelope";
import { taskFields, taskStatus } from "../src/hook/task-fields";
import { SESSION } from "./fixtures/hooks";

const ctx = { repo: "lb-demo-shop", branch: "joshua/checkout", machine: "m", now: 1792807023000 };
const build = (raw: Record<string, unknown>, now = ctx.now) =>
  IngestEnvelope.parse(buildEnvelope(HookInput.parse({ ...SESSION, ...raw }), { ...ctx, now }));
const tool = (tool_name: string, tool_input: Record<string, unknown>, tool_response?: unknown) => ({
  hook_event_name: "PostToolUse",
  tool_name,
  tool_input,
  tool_response,
  tool_use_id: `toolu_${tool_name}`,
});

describe("task envelope fields", () => {
  it("TaskCreated carries key, subject and description; TaskCompleted adds status", () => {
    const created = build({
      hook_event_name: "TaskCreated",
      task_id: "3",
      task_subject: "Cart model",
      task_description: "Cart keyed by User",
    });
    expect(created.task).toEqual({ key: "3", subject: "Cart model", description: "Cart keyed by User" });
    const done = build({ hook_event_name: "TaskCompleted", task_id: 3, task_subject: "Cart model" });
    expect(done.task).toEqual({ key: "3", subject: "Cart model", status: "completed" });
    expect(done.files).toEqual([]);
  });

  it("keys task hooks by task id so two in one millisecond stay distinct", () => {
    const a = build({ hook_event_name: "TaskCreated", task_id: "1", task_subject: "a" });
    const b = build({ hook_event_name: "TaskCreated", task_id: "2", task_subject: "b" });
    expect(a.eventKey).not.toBe(b.eventKey);
  });

  it("reads TaskCreate/TaskUpdate inputs in any of the plausible shapes", () => {
    expect(build(tool("TaskUpdate", { taskId: "2", status: "in_progress" })).task).toEqual({
      key: "2",
      status: "in_progress",
    });
    expect(build(tool("TaskUpdate", { task_id: 2, status: "done" })).task).toEqual({
      key: "2",
      status: "completed",
    });
    expect(
      build(tool("TaskCreate", { subject: "Session handling", description: "cookie" }, { task: { id: "4" } }))
        .task,
    ).toEqual({ key: "4", subject: "Session handling", description: "cookie" });
    expect(build(tool("TaskCreate", { title: "Checkout routes" })).task).toEqual({
      key: "subject:Checkout routes",
      subject: "Checkout routes",
    });
  });

  it("snapshots TodoWrite lists and normalizes status words", () => {
    const e = build(
      tool("TodoWrite", {
        todos: [
          { content: "Cart model", status: "completed", activeForm: "Building the cart" },
          { content: "Checkout routes", status: "in-progress" },
          { content: "", status: "pending" },
          "junk",
        ],
      }),
    );
    expect(e.todos).toEqual([
      { content: "Cart model", status: "completed", activeForm: "Building the cart" },
      { content: "Checkout routes", status: "in_progress" },
    ]);
    expect(e.tool).toBe("TodoWrite");
  });

  it("never throws on unknown shapes; they are just recorded", () => {
    expect(build(tool("TaskUpdate", { weird: true })).task).toBeUndefined();
    expect(build(tool("TodoWrite", { todos: "nope" })).todos).toBeUndefined();
    expect(build(tool("TaskList", {})).task).toBeUndefined();
    expect(taskStatus("deleted")).toBeUndefined();
    expect(taskFields(HookInput.parse({ ...SESSION, hook_event_name: "TaskCreated" }))).toEqual({});
  });
});
