import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

const Entry = z.object({ at: z.string(), suite: z.string(), run: z.string(), costUsd: z.number() });
export type LedgerEntry = z.infer<typeof Entry>;

/** Sum of a JSONL ledger; unreadable lines count as nothing rather than stopping the eval. */
export function ledgerTotal(text: string): number {
  return text.split("\n").reduce((n, line) => {
    if (!line.trim()) return n;
    try {
      const e = Entry.safeParse(JSON.parse(line));
      return e.success ? n + e.data.costUsd : n;
    } catch {
      return n;
    }
  }, 0);
}

/**
 * A spending cap shared by every eval invocation that names the same ledger file, so a pilot spread over
 * several suites stops at one overall figure. Costs are Claude Code's own estimates (`total_cost_usd`).
 */
export class Budget {
  private spent: number;

  constructor(
    readonly capUsd: number,
    private readonly ledger: string | null,
  ) {
    this.spent = ledger && existsSync(ledger) ? ledgerTotal(readFileSync(ledger, "utf8")) : 0;
  }

  /** Re-read on every check: other invocations running at the same time append to the same ledger. */
  get spentUsd(): number {
    if (this.ledger && existsSync(this.ledger)) this.spent = ledgerTotal(readFileSync(this.ledger, "utf8"));
    return this.spent;
  }

  /** True once the cap is reached; jobs not yet started are then skipped. */
  get exhausted(): boolean {
    return this.spentUsd >= this.capUsd;
  }

  add(suite: string, run: string, costUsd: number): void {
    if (!this.ledger) {
      this.spent += costUsd;
      return;
    }
    mkdirSync(dirname(this.ledger), { recursive: true });
    const e: LedgerEntry = { at: new Date().toISOString(), suite, run, costUsd };
    appendFileSync(this.ledger, `${JSON.stringify(e)}\n`);
  }

  line(): string {
    return `$${this.spentUsd.toFixed(2)} of $${this.capUsd.toFixed(0)} cap`;
  }
}
