import { describe, expect, it } from "vitest";
import { HookInput } from "../../packages/core/src/hooks";
import { generateSwarm, swarmHandles } from "../scripts/swarm";

const hookOf = (l: { input?: unknown }) =>
  (l.input as { hook_event_name?: string } | undefined)?.hook_event_name;

describe("swarm generator", () => {
  const lines = generateSwarm({ agents: 10, overlap: 0.5, seed: 3 }).lines;

  it("is deterministic for a seed and differs across seeds", () => {
    expect(generateSwarm({ agents: 10, overlap: 0.5, seed: 3 }).lines).toEqual(lines);
    expect(generateSwarm({ agents: 10, overlap: 0.5, seed: 4 }).lines).not.toEqual(lines);
  });

  it("emits valid hook payloads with unique steps, all agents starting within a second", () => {
    expect(new Set(lines.map((l) => l.step)).size).toBe(lines.length);
    for (const l of lines) if ("input" in l) expect(HookInput.safeParse(l.input).error).toBeUndefined();
    const starts: number[] = [];
    let t = 0;
    for (const l of lines) {
      t += l.delayMs;
      if (hookOf(l) === "SessionStart") starts.push(t);
    }
    expect(starts).toHaveLength(10);
    expect(Math.max(...starts)).toBeLessThan(2000);
    expect(new Set(lines.map((l) => l.as))).toEqual(new Set(swarmHandles(10)));
  });

  it("gives every agent 3–5 tasks with reads, edits and tests", () => {
    for (const as of swarmHandles(10)) {
      const mine = lines.filter((l) => l.as === as);
      const tasks = mine.filter((l) => hookOf(l) === "TaskCreated").length;
      expect(tasks).toBeGreaterThanOrEqual(3);
      expect(tasks).toBeLessThanOrEqual(5);
      const tools = new Set(
        mine.map((l) => ("input" in l ? (l.input.tool_name as string | undefined) : undefined)),
      );
      expect([...tools]).toEqual(expect.arrayContaining(["Read", "Write", "Bash", "TaskUpdate"]));
    }
  });

  it("drives collisions with overlap and none without it", () => {
    const deniedIn = (ls: typeof lines) =>
      ls.filter(
        (l) => l.step.endsWith(".pre") && !ls.some((m) => m.step === l.step.replace(/\.pre$/, ".post")),
      );
    expect(deniedIn(lines).length).toBeGreaterThan(0);
    expect(deniedIn(generateSwarm({ agents: 10, overlap: 0, seed: 3 }).lines)).toEqual([]);
  });
});
