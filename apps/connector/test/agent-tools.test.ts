import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { backoffMs, ProviderError, retryAfterMs, withRetry } from "../src/agent/providers/retry";
import { runTool } from "../src/agent/tools";
import { bashTool } from "../src/agent/tools/shell";

function dir(files: Record<string, string>): string {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "lb-agent-tools-")));
  for (const [p, c] of Object.entries(files)) writeFileSync(join(d, p), c);
  return d;
}

describe("agent tools", () => {
  it("Edit needs a unique match unless replace_all, and returns Claude Code's response shape", async () => {
    const d = dir({ "a.ts": "x\nx\n" });
    const twice = await runTool("Edit", { file_path: "a.ts", old_string: "x", new_string: "y" }, d);
    expect(twice).toMatchObject({ ok: false, text: expect.stringMatching(/occurs 2 times/) });
    const all = await runTool(
      "Edit",
      { file_path: "a.ts", old_string: "x", new_string: "$&y", replace_all: true },
      d,
    );
    expect(all).toMatchObject({ ok: true, response: { originalFile: "x\nx\n", replaceAll: true } });
    expect(readFileSync(join(d, "a.ts"), "utf8")).toBe("$&y\n$&y\n");
    const missing = await runTool("Edit", { file_path: "a.ts", old_string: "zzz", new_string: "q" }, d);
    expect(missing.text).toMatch(/not found/);
  });

  it("Write reports create vs update; Read numbers lines", async () => {
    const d = dir({});
    expect(
      (await runTool("Write", { file_path: "sub/b.ts", content: "one\ntwo" }, d)).response,
    ).toMatchObject({
      type: "create",
      originalFile: null,
    });
    expect((await runTool("Write", { file_path: "sub/b.ts", content: "1" }, d)).response).toMatchObject({
      type: "update",
      originalFile: "one\ntwo",
    });
    expect((await runTool("Read", { file_path: "sub/b.ts" }, d)).text).toBe("     1\t1");
  });

  it("Glob and Grep search the working directory", async () => {
    const d = dir({ "a.ts": "const users = 1;\n", "b.md": "users\n" });
    expect((await runTool("Glob", { pattern: "*.ts" }, d)).text).toBe("a.ts");
    expect((await runTool("Grep", { pattern: "users", glob: "*.ts" }, d)).text).toBe(
      "a.ts:1: const users = 1;",
    );
    expect((await runTool("Grep", { pattern: "(" }, d)).ok).toBe(false);
  });

  it("Bash reports exit codes and kills commands that run too long", async () => {
    const d = dir({});
    expect(await runTool("Bash", { command: "echo hi; echo oops >&2; exit 3" }, d)).toMatchObject({
      ok: false,
      text: "hi\noops\n[exit code 3]",
      response: { stdout: "hi\n", stderr: "oops\n", exit_code: 3 },
    });
    const slow = await bashTool(d, "sleep 5", 200);
    expect(slow).toMatchObject({ ok: false, response: { interrupted: true } });
  });
});

describe("provider retry", () => {
  it("reads Gemini's retryDelay and HTTP Retry-After", () => {
    expect(retryAfterMs('{"retryDelay": "37s"}')).toBe(37_000);
    expect(retryAfterMs("5")).toBe(5000);
    expect(retryAfterMs("Please retry in 4h59m3.5s.")).toBe(17_943_500);
    expect(retryAfterMs("Please retry in 12.5s.")).toBe(12_500);
    expect(retryAfterMs(null)).toBeUndefined();
    expect(backoffMs(0, 90_000, 60_000)).toBe(60_000);
  });

  it("retries 429s and network errors but not 4xx", async () => {
    let n = 0;
    const flaky = () => (++n < 3 ? Promise.reject(new ProviderError("busy", 429, 1)) : Promise.resolve("ok"));
    await expect(withRetry(flaky, { sleep: async () => {} })).resolves.toBe("ok");
    expect(n).toBe(3);
    let m = 0;
    const bad = () => {
      m++;
      return Promise.reject(new ProviderError("bad key", 403));
    };
    await expect(withRetry(bad, { sleep: async () => {} })).rejects.toThrow("bad key");
    expect(m).toBe(1);
    // A spent daily quota says to come back in hours: fail now instead of stalling the run.
    let d = 0;
    const daily = () => {
      d++;
      return Promise.reject(new ProviderError("quota", 429, 4 * 3600_000));
    };
    await expect(withRetry(daily, { sleep: async () => {} })).rejects.toThrow("quota");
    expect(d).toBe(1);
  });
});
