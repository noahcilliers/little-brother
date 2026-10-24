import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeTool } from "../src/normalize";
import { tempRepo } from "./helpers";

const ORDER =
  "export type Order = { id: string; total: number };\nexport function orderTotal(o: Order) {\n  return o.total;\n}\n";

const bash = (root: string, command: string, phase: "pre" | "post" = "pre", cwd = root) =>
  normalizeTool({ tool: "Bash", input: { command }, cwd, repoRoot: root, phase });

describe("normalizeTool on Bash file writes", () => {
  it("treats a heredoc into a new file like a Write create, with its declarations", async () => {
    const root = tempRepo();
    const n = await bash(root, `mkdir -p src/contracts && cat > src/contracts/order.ts <<'E'\n${ORDER}E`);
    expect(n.files).toEqual(["src/contracts/order.ts"]);
    expect(n.touches[0]).toEqual({ path: "src/contracts/order.ts", op: "create", lines: [1, 4] });
    expect(n.touches.map((t) => [t.symbol, t.op])).toEqual(
      expect.arrayContaining([
        ["src/contracts/order.ts::Order", "create"],
        ["src/contracts/order.ts::orderTotal", "create"],
      ]),
    );
  });

  it("covers several files in one command, resolving against the cwd", async () => {
    const root = tempRepo();
    const cmd = `cat > order.ts <<'E'\nexport const a = 1;\nE\ncat > ../../db/schema/orders.ts <<'E'\nexport const orders = 1;\nE`;
    const n = await bash(root, cmd, "pre", join(root, "src/contracts"));
    expect(n.files).toEqual(["src/contracts/order.ts", "db/schema/orders.ts"]);
    expect(n.touches.filter((t) => !t.symbol).map((t) => t.op)).toEqual(["create", "create"]);
  });

  it("diffs an overwrite or append of an existing file against what is on disk", async () => {
    const root = tempRepo({ "src/order.ts": ORDER });
    const n = await bash(root, `cat >> src/order.ts <<'E'\nexport const extra = 1;\nE`);
    expect(n.touches[0]).toEqual({ path: "src/order.ts", op: "write", lines: [5, 5] });
    expect(n.touches).toContainEqual({
      path: "src/order.ts",
      symbol: "src/order.ts::extra",
      op: "create",
      lines: [5, 5],
    });
  });

  it("keeps unknown-content writes as bare file writes and skips paths outside the repo", async () => {
    const root = tempRepo();
    const n = await bash(root, "npm test 2>&1 | tee test.log; echo x > /tmp/lb-scratch.txt; ls > /dev/null");
    expect(n).toEqual({ files: ["test.log"], touches: [{ path: "test.log", op: "write" }], references: [] });
  });

  it("records bare writes on PostToolUse, when create vs overwrite is no longer knowable", async () => {
    const root = tempRepo();
    const n = await bash(root, "cat > a.ts <<'E'\nexport const a = 1;\nE", "post");
    expect(n.touches).toEqual([{ path: "a.ts", op: "write" }]);
  });

  it("leaves commands without writes alone", async () => {
    const root = tempRepo();
    expect(await bash(root, "npm test && git status")).toEqual({ files: [], touches: [], references: [] });
  });

  it("is fast on a typical heredoc create", async () => {
    const root = tempRepo();
    await bash(root, `cat > src/a.ts <<'E'\n${ORDER}E`);
    const t0 = performance.now();
    await bash(root, `cat > src/b.ts <<'E'\n${ORDER.repeat(20)}E`);
    expect(performance.now() - t0).toBeLessThan(50);
  });
});
