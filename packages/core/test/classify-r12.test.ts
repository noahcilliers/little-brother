import { describe, expect, it } from "vitest";
import { scoreCandidates } from "../src/classify/candidates";
import { applyRules } from "../src/classify/pipeline";
import { r12ImporterInterface } from "../src/classify/rules/index";
import { pythonImportKeys } from "../src/code/py-graph";
import { pyResolver } from "../src/code/py-resolve";
import { buildRepoGraph, graphKeysFor } from "../src/repo-graph";
import { node, pair } from "./classify-fixtures";

const changer = (via: "symbol" | "module" = "symbol") =>
  node({
    agentId: "b",
    touches: [
      { path: "helpers.py", op: "write" },
      { path: "helpers.py", symbol: "helpers.py::format_name", op: "signature_change", lines: [1, 1] },
    ],
    importers: [{ symbol: "helpers.py::format_name", files: ["app/consumer.py"], via }],
  });
const consumer = () =>
  node({
    agentId: "a",
    touches: [{ path: "app/consumer.py", op: "write", lines: [40, 42] }],
    references: [],
  });

describe("R12 importer interface", () => {
  it("settles a signature change against an edit to a file importing the symbol", () => {
    const r = r12ImporterInterface.check(pair(changer(), consumer()));
    if (!r || !("judgment" in r)) throw new Error("expected a judgment");
    expect(r.judgment).toMatchObject({
      relation: "semantic_conflict",
      direction: "other_needs_new",
      confidence: 0.8,
    });
    expect(r.judgment.evidence[0]).toContain("signature of format_name changes");
    expect(r.judgment.evidence[0]).toContain("app/consumer.py imports it");
  });

  it("points the direction at the importer when it is the newer event", () => {
    const r = r12ImporterInterface.check(pair(consumer(), changer()));
    expect(r && "judgment" in r && r.judgment.direction).toBe("new_needs_other");
  });

  it("is only a hint when the file imports the whole module", () => {
    const r = r12ImporterInterface.check(pair(changer("module"), consumer()));
    expect(r && "hint" in r && r.hint.rule).toBe("R12");
  });

  it("ignores reads, unrelated files and failure memory", () => {
    const reader = node({ agentId: "a", touches: [{ path: "app/consumer.py", op: "read" }] });
    const elsewhere = node({ agentId: "a", touches: [{ path: "app/other.py", op: "write" }] });
    expect(r12ImporterInterface.check(pair(changer(), reader))).toBeNull();
    expect(r12ImporterInterface.check(pair(changer(), elsewhere))).toBeNull();
    expect(r12ImporterInterface.check(pair(changer(), consumer(), true))).toBeNull();
  });

  it("makes the importer a candidate even when its edit names nothing", () => {
    const next = changer();
    const [p] = scoreCandidates(next, [{ node: consumer(), failedMemory: false }]);
    expect(p?.reasons).toContain("app/consumer.py imports format_name");
    if (!p) throw new Error("no candidate");
    expect(applyRules(p).verdict?.relation).toBe("semantic_conflict");
  });
});

describe("repo graph", () => {
  it("looks a member up under itself, its class and its module", () => {
    expect(graphKeysFor("m.py::A.b")).toEqual([
      { key: "m.py::A.b", via: "symbol" },
      { key: "m.py::A", via: "symbol" },
      { key: "m.py::*", via: "module" },
    ]);
  });

  it("keeps the most-imported keys within the edge budget and drops self-imports", () => {
    const g = buildRepoGraph(
      new Map([
        ["a.py", ["h.py::f", "h.py::g"]],
        ["b.py", ["h.py::f", "b.py::self"]],
        ["c.py", ["h.py::f"]],
      ]),
      "sha",
      () => "hash",
      4,
    );
    const keys = g.edges.map(([k, ids]) => [k, ids.map((i) => g.files[i])]);
    expect(keys).toEqual([
      ["h.py::f", ["a.py", "b.py", "c.py"]],
      ["h.py::g", ["a.py"]],
    ]);
  });

  it("narrows a whole-module import to the attributes the file uses", () => {
    const files: Record<string, string> = {
      "helpers.py": "def format_name(): pass\n",
      "util/__init__.py": "",
    };
    const r = pyResolver({ exists: (p) => p in files, read: (p) => files[p] ?? null });
    const src = "import helpers\nfrom util import *\n\nprint(helpers.format_name())\n";
    expect([...pythonImportKeys("app.py", src, r)].sort()).toEqual([
      "helpers.py::format_name",
      "util/__init__.py::*",
    ]);
  });
});
