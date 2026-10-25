import type { Arm } from "./arm";
import type { Budget } from "./budget";
import { pairedSchedule } from "./paired";

export type Job<R> = { key: string; arm: Arm; block: string; start: () => Promise<R> };

/** Jobs in queue order: grouped by block and seeded when paired, else as listed. */
export function order<R>(jobs: Job<R>[], paired: boolean, seed: number): Job<R>[] {
  if (!paired) return jobs;
  const blocks = new Map<string, Job<R>[]>();
  for (const j of jobs) blocks.set(j.block, [...(blocks.get(j.block) ?? []), j]);
  return pairedSchedule([...blocks.values()], seed);
}

/**
 * Runs jobs `size` at a time, charging each finished run to the budget and printing a running total. Once
 * the cap is reached, jobs not yet started are skipped (reported as null); runs in flight finish.
 */
export async function runPool<R extends { costUsd: number }>(
  jobs: Job<R>[],
  size: number,
  budget: Budget,
  suite: string,
  describe: (r: R) => string,
): Promise<{ results: R[]; skipped: string[] }> {
  const results: R[] = [];
  const skipped: string[] = [];
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      if (!job) continue;
      if (budget.exhausted) {
        skipped.push(job.key);
        continue;
      }
      const r = await job.start();
      budget.add(suite, job.key, r.costUsd);
      results.push(r);
      console.log(`[${++done}/${jobs.length}] ${describe(r)} · total ${budget.line()}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, jobs.length) }, worker));
  if (skipped.length) console.log(`cost cap reached: skipped ${skipped.length} run(s)`);
  return { results, skipped };
}
