import type { EvalCase } from "../src/case";

// Failure memory. A first agent ("yesterday's session") tries an approach that fails and reverts it; a
// second agent starts after it has finished and is asked to try the same thing. The second agent's
// worktree is fresh, so nothing on disk tells it the approach already failed.

export const staleCorsWildcard: EvalCase = {
  id: "stale-cors-wildcard",
  title: "Wildcard CORS with credentials, tried again",
  why: "Browsers reject origin '*' with credentials; the unit test encodes that. The retry should get the lesson.",
  agents: [
    {
      handle: "priya",
      endsSession: true,
      prompt: {
        pointed:
          "The storefront can't reach the API. Add CORS to the API in src/server.ts using the cors package (already installed) with origin: '*' and credentials: true, then run npm test. If npm test still fails, revert with `git checkout src/server.ts` and stop. Don't try anything else.",
        natural:
          "The storefront can't call the API. Try enabling CORS on the API for every origin with credentials allowed, then run npm test. If the test still fails, undo your change and stop there; just report what happened.",
      },
    },
    {
      handle: "ash",
      start: { after: { agent: "priya", event: "done" }, delaySec: 10 },
      prompt: {
        pointed:
          "npm test fails because the storefront can't reach the API. Add the cors middleware in src/server.ts with origin '*' and credentials: true, then run npm test.",
        natural:
          "The storefront can't reach the API and npm test fails. Allow cross-origin requests from anywhere on the API, with cookies allowed, and get npm test passing.",
      },
    },
  ],
  expect: [
    {
      agents: ["ash", "priya"],
      type: "stale",
      relation: "repeats_failure",
      evidence: ["ash-wildcard", "ash-tried"],
    },
  ],
  checks: [
    {
      id: "ash-wildcard",
      kind: "grep",
      pattern: "origin:\\s*[\"'`]\\*",
      paths: ["src"],
      on: "ash",
      minFiles: 1,
    },
    { id: "ash-tried", kind: "touched", agent: "ash", file: "src/server.ts" },
  ],
};

export const staleJsdomEnv: EvalCase = {
  id: "stale-jsdom-env",
  title: "Global jsdom test environment, tried again",
  why: "jsdom isn't installed, so switching the global vitest environment fails; the retry should hear about it first.",
  agents: [
    {
      handle: "priya",
      endsSession: true,
      prompt: {
        pointed:
          "Set test.environment to 'jsdom' in vitest.config.ts so React components can be tested, then run npm test. Don't install packages. If npm test fails, revert with `git checkout vitest.config.ts` and stop.",
        natural:
          "Switch the whole test suite to a browser-like DOM environment so we can test React components, then run the tests. Don't install anything. If they fail, undo it and stop.",
      },
    },
    {
      handle: "ash",
      start: { after: { agent: "priya", event: "done" }, delaySec: 10 },
      prompt: {
        pointed:
          "Set the vitest environment to 'jsdom' in vitest.config.ts so we can test React components, then run npm test.",
        natural:
          "Make our tests run in a DOM environment so React components can be tested, and check that npm test still works.",
      },
    },
  ],
  expect: [
    {
      agents: ["ash", "priya"],
      type: "stale",
      relation: "repeats_failure",
      evidence: ["ash-jsdom", "ash-tried"],
    },
  ],
  checks: [
    {
      id: "ash-jsdom",
      kind: "grep",
      pattern: "environment:\\s*[\"'`]jsdom",
      paths: ["vitest.config.ts"],
      on: "ash",
      minFiles: 1,
    },
    { id: "ash-tried", kind: "touched", agent: "ash", file: "vitest.config.ts" },
  ],
};
