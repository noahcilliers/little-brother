import { describe, expect, it } from "vitest";
import { commandFailed, testOutputFailed } from "../src/command-outcome";

// Real tails from the stale eval cases: both piped through `tail -30`, so the exit code was 0.
const VITEST_ASSERTION = `> lb-demo-shop@0.1.0 test
> vitest run test/unit

 ❯ test/unit/storefront-access.test.ts (1 test | 1 failed) 84ms
   × storefront can reach the API from the browser > via the Vite /api proxy or a credential-safe CORS policy 82ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  test/unit/storefront-access.test.ts > storefront can reach the API from the browser
 Test Files  1 failed (1)
      Tests  1 failed (1)`;

const VITEST_STARTUP = `Error: Cannot find package 'jsdom' imported from node_modules/vitest/dist/chunks/index.js
Serialized Error: { code: 'ERR_MODULE_NOT_FOUND' }

 Test Files   (1)
      Tests  no tests
     Errors  1 error
   Start at  04:12:18`;

describe("testOutputFailed", () => {
  it.each([
    ["vitest assertion", VITEST_ASSERTION],
    ["vitest unhandled error", VITEST_STARTUP],
    ["jest", "FAIL src/a.test.ts\nTests:       1 failed, 3 passed, 4 total"],
    ["pytest", "FAILED tests/test_a.py::test_x\n===== 1 failed, 2 passed in 0.12s ====="],
    ["mocha", "  3 passing (20ms)\n  1 failing"],
    ["tsc", "src/a.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'."],
  ])("sees a %s failure", (_, output) => {
    expect(testOutputFailed(output)).toBe(true);
  });
  it.each([
    ["vitest green", " Test Files  3 passed (3)\n      Tests  12 passed (12)"],
    ["jest green", "Tests:       0 failed, 4 passed, 4 total"],
    ["grep hit", 'test/unit/a.test.ts:4:  it("reports failed logins", () => {'],
    ["no output", undefined],
  ])("ignores %s", (_, output) => {
    expect(testOutputFailed(output)).toBe(false);
  });
});

describe("commandFailed", () => {
  it("trusts a failing hook or exit code", () => {
    expect(commandFailed({ hookFailed: true, verb: "RUN" })).toBe(true);
    expect(commandFailed({ hookFailed: false, exitCode: 2, verb: "RUN" })).toBe(true);
  });
  it("reads a piped test run's output when the exit code is 0", () => {
    expect(commandFailed({ hookFailed: false, exitCode: 0, verb: "TEST", output: VITEST_ASSERTION })).toBe(
      true,
    );
  });
  it("only reads output for test runs", () => {
    expect(commandFailed({ hookFailed: false, exitCode: 0, verb: "RUN", output: VITEST_ASSERTION })).toBe(
      false,
    );
    expect(commandFailed({ hookFailed: false, exitCode: 0, verb: "TEST", output: "14 passed" })).toBe(false);
  });
});
