import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { IngestEnvelope } from "@lb/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGraphFor } from "../src/graph/build";
import { cachedGraph, writeGraph } from "../src/graph/cache";
import { repoInfo } from "../src/hook/git";
import { headSha } from "../src/hook/git-state";
import { addSessionContext } from "../src/hook/repo-graph";
import { normalizeTool } from "../src/normalize";
import { tempHome, tempRepo } from "./helpers";

const HELPERS = `"""Name helpers."""
from __future__ import annotations

import re


def format_name(first: str, last: str) -> str:
    return f"{first} {last}".strip()


@lru_cache(maxsize=None)
def slug(
    text: str,
    sep: str = "-",
) -> str:
    return re.sub(r"\\W+", sep, text)
`;

const ORDERS = `from shop import format_name
from . import helpers


class OrderView:
    def title(self, order):
        return order.id

    async def render(self, order):
        return self.title(order)
`;

const FILES = {
  "src/shop/__init__.py": "from .helpers import format_name as format_name\n",
  "src/shop/helpers.py": HELPERS,
  "src/shop/orders.py": ORDERS,
};

const pre = (root: string, tool: string, input: Record<string, unknown>) =>
  normalizeTool({ tool, input, cwd: root, repoRoot: root, phase: "pre" });

describe("python normalization", () => {
  it("reports a multiline signature change behind a decorator", async () => {
    const root = tempRepo(FILES);
    const n = await pre(root, "Edit", {
      file_path: join(root, "src/shop/helpers.py"),
      old_string: '    sep: str = "-",\n',
      new_string: "    sep: str,\n    lower: bool = True,\n",
    });
    expect(n.touches).toContainEqual({
      path: "src/shop/helpers.py",
      symbol: "src/shop/helpers.py::slug",
      op: "signature_change",
      lines: [14, 15],
    });
    expect(n.touches.find((t) => t.symbol?.endsWith("::format_name"))).toBeUndefined();
  });

  it("resolves calls in the edited method through package re-exports and module imports", async () => {
    const root = tempRepo(FILES);
    const n = await pre(root, "Edit", {
      file_path: join(root, "src/shop/orders.py"),
      old_string: "        return order.id\n",
      new_string: "        return format_name(order.first, helpers.slug(order.last))\n",
    });
    expect(n.touches.map((t) => [t.symbol ?? t.path, t.op])).toEqual([
      ["src/shop/orders.py", "write"],
      ["src/shop/orders.py::OrderView.title", "write"],
    ]);
    expect(n.references.sort()).toEqual(["src/shop/helpers.py::format_name", "src/shop/helpers.py::slug"]);
  });

  it("reports a method rename and a new file's defs", async () => {
    const root = tempRepo(FILES);
    const renamed = await pre(root, "Edit", {
      file_path: join(root, "src/shop/orders.py"),
      old_string: "def title(self, order)",
      new_string: "def heading(self, order)",
    });
    expect(renamed.touches.map((t) => [t.symbol, t.op]).slice(1)).toEqual([
      ["src/shop/orders.py::OrderView.title", "rename"],
      ["src/shop/orders.py::OrderView.heading", "create"],
    ]);
    const created = await pre(root, "Write", {
      file_path: join(root, "src/shop/refunds.py"),
      content: "def refund(order_id: str) -> None:\n    pass\n",
    });
    expect(created.touches.map((t) => [t.symbol ?? t.path, t.op])).toEqual([
      ["src/shop/refunds.py", "create"],
      ["src/shop/refunds.py::refund", "create"],
    ]);
  });
});

describe("repo graph", () => {
  afterEach(() => vi.unstubAllEnvs());

  function gitRepo(): string {
    const root = tempRepo(FILES);
    spawnSync("rm", ["-rf", join(root, ".git")]);
    for (const args of [
      ["init", "-q"],
      ["add", "."],
      ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "x"],
    ])
      spawnSync("git", args, { cwd: root });
    return root;
  }

  it("maps imported symbols to their importers, following re-exports", async () => {
    const root = gitRepo();
    const g = await buildGraphFor(root, "h1");
    const importers = (key: string) => g.edges.find(([k]) => k === key)?.[1].map((i) => g.files[i]);
    expect(importers("src/shop/helpers.py::format_name")).toEqual([
      "src/shop/__init__.py",
      "src/shop/orders.py",
    ]);
    expect(importers("src/shop/helpers.py::*")).toEqual(["src/shop/orders.py"]);
  });

  it("sends the cached graph on SessionStart and nothing on a miss", async () => {
    vi.stubEnv("LB_HOME", tempHome());
    const root = gitRepo();
    const info = repoInfo(root);
    const head = headSha(info);
    if (!head) throw new Error("no HEAD");
    const env = { topicMap: undefined } as unknown as IngestEnvelope;
    addSessionContext(env, info, false);
    expect(env.repoGraph).toBeUndefined();
    writeGraph(info.root, await buildGraphFor(info.root, head));
    expect(cachedGraph(info.root, head)?.head).toBe(head);
    addSessionContext(env, info, false);
    expect(env.repoGraph?.edges.length).toBeGreaterThan(0);
  });
});
