import { expect, test } from "vitest";
import { resultLine } from "../convex/dashboardQueries/sessions";

test("skips the harness's cwd-reset note and keeps the command's own last line", () => {
  const out = "added 12 packages\nnpm 10.8.1\nShell cwd was reset to /Users/dev/projects/shop";
  expect(resultLine(out)).toBe("npm 10.8.1");
});

test("a result that is only harness noise has no line", () => {
  expect(resultLine("Shell cwd was reset to /Users/dev/shop\n(no output)")).toBe("");
});

test("a test summary still wins over later lines", () => {
  const out = "Tests  3 passed (3)\nDuration 1.2s\nShell cwd was reset to /tmp/x";
  expect(resultLine(out)).toBe("3 passed (3)");
});
