import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

/**
 * Every classifier run goes through this queue. A burst of hooks from several sessions used to start one run
 * per event at once, each with up to four judge calls, and trip the model's 429s. Ten at a time stays under
 * the free plan's 20 concurrent functions. A run that throws is retried with jittered backoff: rules and
 * dedupe make re-runs safe.
 */
export const classifyPool = new Workpool(components.classifyPool, {
  maxParallelism: 10,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 1000, base: 2 },
});
