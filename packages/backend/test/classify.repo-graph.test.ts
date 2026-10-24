import type { IngestEnvelope, RepoGraph } from "@lb/core";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { envelope, hook, joinMember, makeT, type T } from "./platformHelpers";

const GRAPH: RepoGraph = {
  v: 1,
  head: "abc123",
  hash: "g1",
  files: ["app/consumer.py", "app/report.py"],
  edges: [
    ["helpers.py::format_name", [0]],
    ["helpers.py::*", [1]],
  ],
};

const consumerEdit = (session: string): Partial<IngestEnvelope> => ({
  tool: "Edit",
  files: ["app/consumer.py"],
  // The edit itself never names format_name: only the graph links the two sides.
  touches: [
    { path: "app/consumer.py", op: "write", lines: [40, 42] },
    { path: "app/consumer.py", symbol: "app/consumer.py::render_badge", op: "write", lines: [40, 42] },
  ],
  references: [],
  toolUseId: `${session}-consumer`,
});

const signatureEdit = (session: string): Partial<IngestEnvelope> => ({
  tool: "Edit",
  files: ["helpers.py"],
  touches: [
    { path: "helpers.py", op: "write", lines: [1, 1] },
    { path: "helpers.py", symbol: "helpers.py::format_name", op: "signature_change", lines: [1, 1] },
  ],
  references: [],
  toolUseId: `${session}-helpers`,
});

async function setup(t: T) {
  const ash = await joinMember(t, "ash");
  const noah = await joinMember(t, "noah");
  await hook(t, ash, envelope("SessionStart", "a1", { repoGraph: GRAPH }));
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  await hook(t, noah, envelope("SessionStart", "n1"));
  return { ash, noah };
}

const r12Rows = (t: T) =>
  t.run(async (ctx) =>
    (await ctx.db.query("classifications").collect()).filter((c) =>
      c.evidence.some((e) => e.startsWith("R12")),
    ),
  );

describe("repo graph (R12)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("SessionStart stores the graph once and keeps it out of the event log", async () => {
    const t = makeT();
    await setup(t);
    const state = await t.run(async (ctx) => ({
      rows: await ctx.db.query("repoImports").collect(),
      meta: await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", "graph:lb-demo-shop"))
        .first(),
      logged: (await ctx.db.query("events").collect()).map((e) => "repoGraph" in (e.payload?.envelope ?? {})),
    }));
    expect(state.rows.map((r) => [r.key, r.files])).toEqual([
      ["helpers.py::format_name", ["app/consumer.py"]],
      ["helpers.py::*", ["app/report.py"]],
    ]);
    expect(state.meta?.value).toMatchObject({ hash: "g1", head: "abc123" });
    expect(state.logged).toEqual([false, false]);
  });

  test("a signature change after an importer's edit is a semantic conflict for the changer", async () => {
    const t = makeT();
    const { ash, noah } = await setup(t);
    await hook(t, ash, envelope("PreToolUse", "a1", consumerEdit("a1")));
    await hook(t, noah, envelope("PreToolUse", "n1", signatureEdit("n1")));
    const [row, ...rest] = await r12Rows(t);
    expect(rest).toHaveLength(0);
    expect(row).toMatchObject({
      relation: "semantic_conflict",
      direction: "other_needs_new",
      confidence: 0.8,
    });
    expect(row?.evidence.join(" ")).toContain("app/consumer.py imports it");
  });

  test("an importer's edit after the signature change is caught on the importer's side", async () => {
    const t = makeT();
    const { ash, noah } = await setup(t);
    await hook(t, noah, envelope("PreToolUse", "n1", signatureEdit("n1")));
    const changer = await t.run(async (ctx) =>
      (await ctx.db.query("nodes").collect()).find((n) => n.files.includes("helpers.py")),
    );
    expect(changer?.importers).toEqual([
      { symbol: "helpers.py::format_name", via: "symbol", files: ["app/consumer.py"] },
      { symbol: "helpers.py::format_name", via: "module", files: ["app/report.py"] },
    ]);
    await hook(t, ash, envelope("PreToolUse", "a1", consumerEdit("a1")));
    const [row] = await r12Rows(t);
    expect(row).toMatchObject({ relation: "semantic_conflict", direction: "new_needs_other" });
  });

  test("a new graph replaces the old generation", async () => {
    const t = makeT();
    await setup(t);
    const next: RepoGraph = { ...GRAPH, hash: "g2", head: "def456", edges: [["helpers.py::slug", [0]]] };
    await t.mutation(internal.repoGraph.store, { repo: "lb-demo-shop", graph: next });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const keys = await t.run(async (ctx) => (await ctx.db.query("repoImports").collect()).map((r) => r.key));
    expect(keys).toEqual(["helpers.py::slug"]);
  });
});
