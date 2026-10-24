import { describe, expect, it } from "vitest";
import { distillTrajectory, type TrajectoryStep } from "../src/classify/distill";
import { type RevertStep, revertedEdits } from "../src/classify/revert";
import { isFailureMemory } from "../src/classify/view";

const edit = (id: string, at: number, files = ["src/server.ts"]): RevertStep => ({
  id,
  verb: "EDIT",
  outcome: "succeeded",
  files,
  at,
});
const test = (id: string, at: number, outcome: "failed" | "succeeded"): RevertStep => ({
  id,
  verb: "TEST",
  outcome,
  files: [],
  at,
});

describe("revertedEdits", () => {
  it("fails the edits a revert throws away after a red test", () => {
    const steps = [edit("use", 1), edit("import", 2), test("t", 3, "failed")];
    expect(revertedEdits(steps, { paths: ["src/server.ts"], at: 4 })).toEqual(["use", "import"]);
  });
  it("keeps edits to paths the revert did not touch", () => {
    const steps = [edit("a", 1), edit("b", 2, ["web/vite.config.ts"]), test("t", 3, "failed")];
    expect(revertedEdits(steps, { paths: ["src/server.ts"], at: 4 })).toEqual(["a"]);
  });
  it("covers directories and the whole tree", () => {
    const steps = [edit("a", 1), edit("b", 2, ["web/vite.config.ts"]), test("t", 3, "failed")];
    expect(revertedEdits(steps, { paths: ["src"], at: 4 })).toEqual(["a"]);
    expect(revertedEdits(steps, { paths: ["."], at: 4 })).toEqual(["a", "b"]);
  });
  it("only reaches back to the last green test", () => {
    const steps = [edit("kept", 1), test("g", 2, "succeeded"), edit("tried", 3), test("r", 4, "failed")];
    expect(revertedEdits(steps, { paths: ["src/server.ts"], at: 5 })).toEqual(["tried"]);
  });
  it("includes edits made after the red test, before giving up", () => {
    const steps = [edit("a", 1), test("r", 2, "failed"), { ...edit("b", 3), verb: "FIX" }];
    expect(revertedEdits(steps, { paths: ["src/server.ts"], at: 4 })).toEqual(["a", "b"]);
  });
  it("is not a failure when the last test passed or nothing was tested", () => {
    expect(revertedEdits([edit("a", 1), test("g", 2, "succeeded")], { paths: ["."], at: 3 })).toEqual([]);
    expect(revertedEdits([edit("a", 1)], { paths: ["."], at: 2 })).toEqual([]);
  });
  it("ignores steps after the revert", () => {
    const steps = [edit("a", 1), test("r", 2, "failed"), edit("later", 4)];
    expect(revertedEdits(steps, { paths: ["src/server.ts"], at: 3 })).toEqual(["a"]);
  });
});

describe("a reverted attempt as failure memory, without a model", () => {
  it("distills a FAIL lesson keyed by the first reverted edit", () => {
    const intent: TrajectoryStep = {
      verb: "PLAN",
      text: "PLAN api.cors add cors",
      topic: "api.cors",
      outcome: "open",
      files: [],
      at: 0,
    };
    const raw = [
      { ...edit("use", 1), text: "EDIT api.cors src/server.ts", signature: "sig-use", topic: "api.cors" },
      {
        ...edit("import", 2),
        text: "EDIT api.cors src/server.ts",
        signature: "sig-import",
        topic: "api.cors",
      },
      {
        ...test("t", 3, "failed"),
        text: "TEST npm test | tail -30 → FAIL",
        output: "→ browsers reject Access-Control-Allow-Origin: * when credentials are allowed: expected '*'",
      },
    ];
    const failedIds = new Set(revertedEdits(raw, { paths: ["src/server.ts"], at: 4 }));
    const steps: TrajectoryStep[] = raw.map(({ id, ...s }) => ({
      ...s,
      outcome: failedIds.has(id) ? "failed" : s.outcome,
    }));
    const lesson = distillTrajectory(intent, steps);
    expect(lesson).toMatchObject({ outcome: "failed", signature: "sig-use", topic: "api.cors" });
    expect(lesson?.text).toBe(
      "LEARN api.cors: tried EDIT api.cors src/server.ts → FAIL: browsers reject Access-Control-Allow-Origin: * when credentials are allowed",
    );
    expect(isFailureMemory({ kind: "knowledge", outcome: "failed", text: lesson?.text ?? "" })).toBe(true);
  });
});
