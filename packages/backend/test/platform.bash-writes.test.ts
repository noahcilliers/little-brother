import type { Touch } from "@lb/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { envelope, hook, joinMember, makeT } from "./platformHelpers";

const PATH = "src/contracts/order.ts";
const COMMAND = `mkdir -p src/contracts && cat > ${PATH} <<'E'\nexport type Order = { id: string };\nE`;
// What the connector sends for that command (see apps/connector normalize/bash.ts).
const touches: Touch[] = [
  { path: PATH, op: "create", lines: [1, 1] },
  { path: PATH, symbol: `${PATH}::Order`, op: "create", lines: [1, 1] },
];
const bashCreate = (session: string, toolUseId: string) =>
  envelope("PreToolUse", session, { tool: "Bash", command: COMMAND, toolUseId, files: [PATH], touches });
const writeCreate = (session: string, toolUseId: string) =>
  envelope("PreToolUse", session, { tool: "Write", toolUseId, files: [PATH], touches });

const isDuplicateDeny = (output: unknown) => {
  const text = JSON.stringify(output);
  return text.includes('"deny"') && text.includes(`${PATH} is already being created`);
};

describe("files created by Bash redirects", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("a Write of a file another agent created with a heredoc is denied as a duplicate", async () => {
    const t = makeT();
    const maya = await joinMember(t, "maya");
    const joshua = await joinMember(t, "joshua");
    await hook(t, maya, envelope("UserPromptSubmit", "m1", { prompt: "add the order model" }));
    await hook(t, joshua, envelope("UserPromptSubmit", "j1", { prompt: "add the order model" }));
    expect((await hook(t, maya, bashCreate("m1", "tu_m"))).output).toBeNull();
    await hook(
      t,
      maya,
      envelope("PostToolUse", "m1", {
        tool: "Bash",
        command: COMMAND,
        toolUseId: "tu_m",
        files: [PATH],
        touches: [{ path: PATH, op: "write" }],
        exitCode: 0,
      }),
    );
    expect(isDuplicateDeny((await hook(t, joshua, writeCreate("j1", "tu_j"))).output)).toBe(true);
  });

  test("a heredoc create of a file another agent is writing gets the same deny a Write would", async () => {
    const t = makeT();
    const maya = await joinMember(t, "maya");
    const joshua = await joinMember(t, "joshua");
    await hook(t, joshua, envelope("UserPromptSubmit", "j1", { prompt: "add the order model" }));
    await hook(t, maya, envelope("UserPromptSubmit", "m1", { prompt: "add the order model" }));
    expect((await hook(t, joshua, writeCreate("j1", "tu_j"))).output).toBeNull();
    expect(isDuplicateDeny((await hook(t, maya, bashCreate("m1", "tu_m"))).output)).toBe(true);
  });
});
