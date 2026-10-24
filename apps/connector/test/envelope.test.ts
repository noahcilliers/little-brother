import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HookInput, IngestEnvelope } from "@lb/core";
import { describe, expect, it } from "vitest";
import { buildEnvelope } from "../src/hook/envelope";
import { repoInfo } from "../src/hook/git";
import { transcriptTokens, transcriptToolUsage } from "../src/hook/transcript";
import * as fx from "./fixtures/hooks";
import { tempRepo } from "./helpers";

const ctx = { repo: "lb-demo-shop", branch: "noah/auth", machine: "noah-mbp", now: 1792807023000 };
const build = (raw: unknown, extra: Partial<Parameters<typeof buildEnvelope>[1]> = {}) =>
  IngestEnvelope.parse(buildEnvelope(HookInput.parse(raw), { ...ctx, ...extra }));

describe("buildEnvelope", () => {
  it("truncates the prompt to 500 chars", () => {
    const e = build(fx.userPrompt);
    expect(e.prompt).toHaveLength(500);
    expect(e.session).toEqual({
      claudeSessionId: "9f1c2a",
      repo: "lb-demo-shop",
      branch: "noah/auth",
      machine: "noah-mbp",
      cwd: "/tmp/lb-demo-shop",
    });
  });

  it("uses a deterministic eventKey from tool_use_id", () => {
    expect(build(fx.preBash).eventKey).toBe(build(fx.preBash, { now: 1 }).eventKey);
    expect(build(fx.stop).eventKey).not.toBe(build(fx.stop, { now: 1 }).eventKey);
  });

  it("carries command and preview for PreToolUse Bash without an exit code", () => {
    const e = build(fx.preBash);
    expect(e).toMatchObject({
      tool: "Bash",
      command: "pnpm test --filter api",
      preview: "pnpm test --filter api",
    });
    expect(e.exitCode).toBeUndefined();
  });

  it("records exit 0 and the last 20 output lines for PostToolUse Bash", () => {
    const e = build(fx.postBash);
    expect(e.exitCode).toBe(0);
    expect(e.outputTail?.split("\n")).toHaveLength(20);
    expect(e.outputTail?.endsWith("line 30")).toBe(true);
  });

  it("records a non-zero exit and the error for PostToolUseFailure", () => {
    const e = build(fx.postBashFailure);
    expect(e.exitCode).not.toBe(0);
    expect(e.outputTail).toContain("Failed to connect");
  });

  it("caps the Stop preview at 40 lines and carries tokens", () => {
    const e = build(fx.stop, { tokens: 132 });
    expect(e.preview?.split("\n")).toHaveLength(40);
    expect(e).toMatchObject({ stopHookActive: false, tokens: 132 });
  });
});

describe("transcriptTokens", () => {
  it("sums assistant usage once per message id and tolerates junk", () => {
    const p = join(mkdtempSync(join(tmpdir(), "lb-tr-")), "t.jsonl");
    writeFileSync(p, fx.transcriptLines);
    expect(transcriptTokens(p)).toBe(125);
    expect(transcriptTokens("/does/not/exist")).toBeUndefined();
  });
});

describe("transcriptToolUsage", () => {
  it("attributes each tool call its message's new tokens and puts them on the Stop envelope", () => {
    const p = join(mkdtempSync(join(tmpdir(), "lb-tr-")), "t.jsonl");
    const usage = {
      input_tokens: 4,
      cache_creation_input_tokens: 196,
      cache_read_input_tokens: 9000,
      output_tokens: 80,
    };
    const lines = [
      { type: "user", message: { content: "add search" } },
      { type: "assistant", message: { id: "m1", usage, content: [{ type: "tool_use", id: "toolu_a" }] } },
      { type: "assistant", message: { id: "m1", usage, content: [{ type: "tool_use", id: "toolu_b" }] } },
    ];
    writeFileSync(p, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n{"type":"assist`);
    const u = transcriptToolUsage(p);
    expect(u).toEqual({ toolTokens: { toolu_a: 140, toolu_b: 140 }, turnTokens: 280 });
    expect(transcriptToolUsage("/does/not/exist")).toBeUndefined();
    const e = build(fx.stop, { usage: u });
    expect(e).toMatchObject({ toolTokens: { toolu_a: 140, toolu_b: 140 }, turnTokens: 280 });
  });
});

describe("repoInfo", () => {
  it("reads repo name and branch without spawning git", () => {
    const root = tempRepo({ "src/a.ts": "" });
    const info = repoInfo(join(root, "src"));
    expect(info).toMatchObject({ root, branch: "noah/auth" });
  });
});
