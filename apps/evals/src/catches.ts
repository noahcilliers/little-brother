import { pairKey } from "./score";

/** The fields of a classification row that say which catch it belongs to and what it was credited. */
export type CatchRow = {
  type: string;
  agents: string[];
  tokensSaved?: number | null;
  catchKey?: string | null;
};

/** One coordination event: the backend's catchKey, or the agent pair and verdict type for older rows. */
export const catchIdOf = (r: CatchRow): string => r.catchKey ?? `${pairKey(r.agents)}:${r.type}`;

/**
 * Savings credited once per distinct catch. Every step that re-triggers a catch writes another row with the
 * same estimate, so summing rows counted one catch several times (about 3× in the first off/on eval). The
 * largest estimate stands for the catch, since later rows only know more about the work it spared.
 */
export function distinctCatchSavings(rows: CatchRow[]): { catches: number; tokensSaved: number } {
  const best = new Map<string, number>();
  for (const r of rows) {
    if (r.type === "normal") continue;
    const id = catchIdOf(r);
    best.set(id, Math.max(best.get(id) ?? 0, r.tokensSaved ?? 0));
  }
  return { catches: best.size, tokensSaved: [...best.values()].reduce((a, b) => a + b, 0) };
}
