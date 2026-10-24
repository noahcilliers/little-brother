import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeTool } from "../src/normalize";
import { tempRepo } from "./helpers";

const PAY = `import { convert } from "./fx";

export function pay(amount: number): boolean {
  return amount > 0;
}

export function refund(id: string) {
  return id;
}
`;

const pre = (root: string, tool: string, input: Record<string, unknown>) =>
  normalizeTool({ tool, input, cwd: root, repoRoot: root, phase: "pre" });

describe("normalizeTool", () => {
  it("marks a Write to a new file as create, with its declarations", async () => {
    const root = tempRepo();
    const n = await pre(root, "Write", {
      file_path: join(root, "db/schema/users.ts"),
      content: "export const users = table('users');\nexport interface User { id: string }\n",
    });
    expect(n.files).toEqual(["db/schema/users.ts"]);
    expect(n.touches[0]).toMatchObject({ path: "db/schema/users.ts", op: "create" });
    expect(n.touches.map((t) => [t.symbol, t.op])).toEqual(
      expect.arrayContaining([
        ["db/schema/users.ts::users", "create"],
        ["db/schema/users.ts::User", "create"],
      ]),
    );
  });

  it("marks an Edit inside a body as a symbol write with line range", async () => {
    const root = tempRepo({ "src/pay.ts": PAY });
    const n = await pre(root, "Edit", {
      file_path: join(root, "src/pay.ts"),
      old_string: "return amount > 0;",
      new_string: "return amount >= 0;",
    });
    expect(n.touches).toContainEqual({
      path: "src/pay.ts",
      symbol: "src/pay.ts::pay",
      op: "write",
      lines: [4, 4],
    });
    expect(n.touches.find((t) => t.symbol === "src/pay.ts::refund")).toBeUndefined();
  });

  it("detects signature_change on an exported function", async () => {
    const root = tempRepo({ "src/pay.ts": PAY });
    const n = await pre(root, "Edit", {
      file_path: "src/pay.ts",
      old_string: "pay(amount: number)",
      new_string: "pay(amount: number, currency: string)",
    });
    expect(n.touches.find((t) => t.symbol === "src/pay.ts::pay")?.op).toBe("signature_change");
  });

  it("ignores parameter renames", async () => {
    const root = tempRepo({ "src/pay.ts": PAY });
    const n = await pre(root, "Edit", {
      file_path: "src/pay.ts",
      old_string: "pay(amount",
      new_string: "pay(_amount",
    });
    expect(n.touches.find((t) => t.symbol === "src/pay.ts::pay")?.op).toBe("write");
  });

  it("detects signature_change from the PostToolUse side too", async () => {
    const root = tempRepo({
      "src/pay.ts": PAY.replace("pay(amount: number)", "pay(amount: number, c: string)"),
    });
    const n = await normalizeTool({
      tool: "Edit",
      input: {
        file_path: "src/pay.ts",
        old_string: "pay(amount: number)",
        new_string: "pay(amount: number, c: string)",
      },
      cwd: root,
      repoRoot: root,
      phase: "post",
    });
    expect(n.touches.find((t) => t.symbol === "src/pay.ts::pay")?.op).toBe("signature_change");
  });

  it("reports a removed declaration as delete", async () => {
    const root = tempRepo({ "src/pay.ts": PAY });
    const n = await pre(root, "Edit", {
      file_path: "src/pay.ts",
      old_string: "export function refund(id: string) {\n  return id;\n}\n",
      new_string: "",
    });
    expect(n.touches).toContainEqual(expect.objectContaining({ symbol: "src/pay.ts::refund", op: "delete" }));
  });

  it("applies MultiEdit with replace_all and finds new declarations", async () => {
    const root = tempRepo({ "src/pay.ts": PAY });
    const n = await pre(root, "MultiEdit", {
      file_path: "src/pay.ts",
      edits: [
        { old_string: "number", new_string: "bigint", replace_all: true },
        {
          old_string: "export function refund",
          new_string: "export function void_(x: string) {}\nexport function refund",
        },
      ],
    });
    const ops = Object.fromEntries(n.touches.filter((t) => t.symbol).map((t) => [t.symbol, t.op]));
    expect(ops["src/pay.ts::void_"]).toBe("create");
    expect(ops["src/pay.ts::pay"]).toBe("signature_change");
  });

  it("collects imported and called references in the changed region", async () => {
    const root = tempRepo({
      "src/fx.ts": "export const convert = (n: number) => n;\n",
      "src/pay.ts": PAY,
    });
    const n = await pre(root, "Edit", {
      file_path: "src/pay.ts",
      old_string: "return amount > 0;",
      new_string: "log(amount);\n  return convert(amount) > 0 && refund('x') === 'x';",
    });
    expect(n.references).toEqual(expect.arrayContaining(["src/fx.ts::convert", "src/pay.ts::refund", "log"]));
  });

  it("names imports of files not on this branch yet by their .ts path, as their creator's touches do", async () => {
    const root = tempRepo({});
    const n = await pre(root, "Write", {
      file_path: "src/notify/order-email.ts",
      content:
        'import type { Order } from "../contracts/order";\n\nexport function subject(order: Order): string {\n  return order.id;\n}\n',
    });
    expect(n.references).toContain("src/contracts/order.ts::Order");
  });

  it("tags generated paths from defaults and .littlebrother.json", async () => {
    const root = tempRepo({ ".littlebrother.json": JSON.stringify({ generated: ["gen/**"] }) });
    const n = await pre(root, "Write", { file_path: "gen/api.ts", content: "export const x = 1;\n" });
    expect(n.touches.every((t) => t.generated)).toBe(true);
    const root2 = tempRepo();
    const lock = await pre(root2, "Write", { file_path: "pnpm-lock.yaml", content: "lockfileVersion: 9\n" });
    expect(lock.touches[0]).toMatchObject({ op: "create", generated: true });
  });

  it("uses file-level touches for other languages and read ops for Read/Grep", async () => {
    const root = tempRepo({ "app.py": "def f():\n  pass\n" });
    const py = await pre(root, "Edit", { file_path: "app.py", old_string: "pass", new_string: "return 1" });
    expect(py.touches).toEqual([{ path: "app.py", op: "write", lines: [2, 2] }]);
    expect((await pre(root, "Read", { file_path: join(root, "app.py") })).touches).toEqual([
      { path: "app.py", op: "read" },
    ]);
    expect((await pre(root, "Grep", { pattern: "x", path: "src" })).touches).toEqual([
      { path: "src", op: "read" },
    ]);
  });

  it("degrades to a file-level write when the edit does not apply, and never throws", async () => {
    const root = tempRepo({ "src/pay.ts": PAY });
    const n = await pre(root, "Edit", { file_path: "src/pay.ts", old_string: "nope", new_string: "x" });
    expect(n.touches).toEqual([{ path: "src/pay.ts", op: "write" }]);
    writeFileSync(join(root, "src/broken.ts"), "export function (((");
    const b = await pre(root, "Edit", { file_path: "src/broken.ts", old_string: "(((", new_string: "((( {" });
    expect(b.touches[0]).toMatchObject({ path: "src/broken.ts", op: "write" });
    await expect(pre(root, "Edit", { file_path: 42 })).resolves.toEqual({
      files: [],
      touches: [],
      references: [],
    });
  });

  it("is fast on a typical edit", async () => {
    const root = tempRepo({ "src/pay.ts": PAY.repeat(20) });
    await pre(root, "Edit", {
      file_path: "src/pay.ts",
      old_string: "return id;",
      new_string: "return id + 1;",
    });
    const t0 = performance.now();
    await pre(root, "Edit", {
      file_path: "src/pay.ts",
      old_string: "return id;",
      new_string: "return id + 2;",
    });
    expect(performance.now() - t0).toBeLessThan(50);
  });
});
