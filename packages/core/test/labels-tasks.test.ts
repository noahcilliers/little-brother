import { describe, expect, it } from "vitest";
import { HookInput } from "../src/hooks";
import { IngestEnvelope } from "../src/ingest";
import { actionLabel, primarySymbol, symbolDisplay } from "../src/labels";
import { firstSentence, inferredSubject } from "../src/tasks";

describe("actionLabel", () => {
  it("names the primary symbol, creates first", () => {
    expect(
      actionLabel({
        verb: "EDIT",
        files: ["db/schema/users.ts"],
        touches: [
          { path: "db/schema/users.ts", op: "create" },
          { path: "db/schema/users.ts", symbol: "db/schema/users.ts::users", op: "create" },
          { path: "db/schema/users.ts", symbol: "db/schema/users.ts::findUserByEmail", op: "create" },
          { path: "db/schema/users.ts", symbol: "db/schema/users.ts::toPublicUser", op: "create" },
        ],
      }),
    ).toBe("create users, findUserByEmail() +1");
    expect(
      actionLabel({
        verb: "EDIT",
        files: ["src/auth/issue-token.ts"],
        touches: [
          { path: "src/auth/issue-token.ts", op: "write" },
          { path: "src/auth/issue-token.ts", symbol: "src/auth/issue-token.ts::issueToken", op: "write" },
        ],
      }),
    ).toBe("edit issueToken()");
  });

  it("labels commands by their head and falls back to the file basename", () => {
    expect(actionLabel({ verb: "TEST", touches: [], files: [], command: "npm   test" })).toBe("run npm test");
    expect(
      actionLabel({
        verb: "FIX",
        files: ["web/vite.config.ts"],
        touches: [{ path: "web/vite.config.ts", op: "write" }],
      }),
    ).toBe("fix vite.config.ts");
    expect(actionLabel({ verb: "EXPLORE", files: ["web/src/App.tsx"], touches: [] })).toBe("read App.tsx");
    expect(actionLabel({ verb: "ACT", tool: "WebFetch", files: [], touches: [] })).toBe("act WebFetch");
  });

  it("shows camelCase compounds as calls, words and types as names", () => {
    expect(symbolDisplay("a.ts::issueToken")).toBe("issueToken()");
    expect(symbolDisplay("a.ts::users")).toBe("users");
    expect(symbolDisplay("a.ts::User")).toBe("User");
    expect(primarySymbol([])).toBeUndefined();
  });
});

describe("task helpers", () => {
  it("firstSentence strips the tag and stops at the first sentence", () => {
    expect(firstSentence("[little-brother] duplicate · db.users is owned by @noah. Import User.\nmore")).toBe(
      "duplicate · db.users is owned by @noah.",
    );
    expect(firstSentence("no period here")).toBe("no period here");
  });

  it("inferredSubject is verb + topic", () => {
    expect(inferredSubject({ verb: "EDIT", topic: "api.cors" })).toBe("edit api.cors");
    expect(inferredSubject({ verb: "TEST", label: "run npm test" })).toBe("run npm test");
  });
});

describe("task contracts", () => {
  it("HookInput accepts TaskCreated/TaskCompleted with numeric or missing ids", () => {
    const base = { session_id: "s", cwd: "/x" };
    expect(
      HookInput.safeParse({ ...base, hook_event_name: "TaskCreated", task_id: 3, task_subject: "Cart model" })
        .success,
    ).toBe(true);
    expect(HookInput.safeParse({ ...base, hook_event_name: "TaskCompleted", extra: 1 }).success).toBe(true);
  });

  it("IngestEnvelope carries an optional task and todos", () => {
    const env = {
      v: 1,
      eventKey: "k",
      hook: "PostToolUse",
      session: { claudeSessionId: "s", repo: "r", branch: "b", machine: "m", cwd: "/x" },
      files: [],
      touches: [],
      references: [],
      at: 1,
    };
    expect(IngestEnvelope.safeParse(env).success).toBe(true);
    expect(
      IngestEnvelope.safeParse({
        ...env,
        task: { key: "1", subject: "Cart model", status: "in_progress" },
        todos: [{ content: "a", status: "pending" }],
      }).success,
    ).toBe(true);
    expect(IngestEnvelope.safeParse({ ...env, task: { key: "1", status: "deleted" } }).success).toBe(false);
  });
});
