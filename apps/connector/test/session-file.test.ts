import { existsSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ancestorsOf, parsePsTable, processAncestors } from "../src/hook/process-tree";
import { readSessionId, readSessionIdFor, sessionDir, writeSessionId } from "../src/hook/session-file";
import { tempHome, tempRepo } from "./helpers";

// Shape of the desktop app's tree: Claude.app → per-session helper → claude → hook/mcp process.
const PS = [
  "    1     0 /sbin/launchd",
  "  100     1 /Applications/Claude.app/Contents/MacOS/Claude",
  "  200   100 /Applications/Claude.app/Contents/Helpers/disclaimer",
  "  201   200 /Users/n/Library/Application Support/Claude/claude-code/2.1/claude.app/Contents/MacOS/claude",
  "  202   201 /usr/local/bin/node",
  "  203   201 /bin/sh",
  "  204   203 /usr/local/bin/node",
  "  300   100 /Applications/Claude.app/Contents/Helpers/disclaimer",
  "  301   300 /Users/n/Library/Application Support/Claude/claude-code/2.1/claude.app/Contents/MacOS/claude",
  "  302   301 /usr/local/bin/node",
].join("\n");

describe("process tree", () => {
  const rows = parsePsTable(PS);

  it("parses comm with spaces", () => {
    expect(rows.get(201)?.comm).toContain("Application Support");
    expect(rows.get(201)?.ppid).toBe(200);
  });

  it("stops at the session's claude process, leaving the shared app out", () => {
    expect(ancestorsOf(202, rows)).toEqual([201]);
    expect(ancestorsOf(204, rows)).toEqual([203, 201]);
    expect(ancestorsOf(302, rows)).toEqual([301]);
  });

  it("walks the capped chain when no claude process is in sight", () => {
    const npm = parsePsTable(["1 0 launchd", "10 1 zsh", "11 10 node", "12 11 node"].join("\n"));
    expect(ancestorsOf(12, npm)).toEqual([11, 10]);
  });

  it("survives a cycle", () => {
    expect(ancestorsOf(5, parsePsTable("5 6 a\n6 5 b"))).toEqual([6, 5]);
  });

  it("starts at this process's parent", () => {
    if (process.platform === "win32") return;
    expect(processAncestors()[0]).toBe(process.ppid);
  });
});

describe("session id records", () => {
  beforeEach(() => {
    process.env.LB_HOME = tempHome({});
    process.env.LB_SESSION_DIR = join(process.env.LB_HOME, "sessions");
  });

  it("keeps two sessions in one folder apart (the later one no longer takes over the first's MCP posts)", () => {
    const repo = tempRepo();
    const rows = parsePsTable(PS);
    writeSessionId("session-a", repo, ancestorsOf(204, rows));
    writeSessionId("session-b", repo, ancestorsOf(302, rows));
    // lb mcp of session A is a direct child of A's claude process (201).
    expect(readSessionIdFor(ancestorsOf(202, rows))).toBe("session-a");
    expect(readSessionIdFor([301])).toBe("session-b");
    // The folder copy still holds whichever started last.
    expect(readSessionId(repo)).toBe("session-b");
  });

  it("prefers the nearest parent's record", () => {
    writeSessionId("outer", undefined, [50]);
    writeSessionId("inner", undefined, [40]);
    expect(readSessionIdFor([40, 50])).toBe("inner");
    expect(readSessionIdFor([41, 50])).toBe("outer");
    expect(readSessionIdFor([41])).toBe("");
  });

  it("prunes records older than a week on the next write", () => {
    writeSessionId("old", undefined, [70]);
    const old = join(sessionDir(), "pid", "70.json");
    const weekAgo = (Date.now() - 8 * 24 * 60 * 60 * 1000) / 1000;
    utimesSync(old, weekAgo, weekAgo);
    writeSessionId("new", undefined, [71]);
    expect(existsSync(old)).toBe(false);
    expect(readSessionIdFor([71])).toBe("new");
  });
});
