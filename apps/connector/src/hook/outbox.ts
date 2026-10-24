import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { IngestEnvelope } from "@lb/core";
import { z } from "zod";
import { lbHome } from "../config";

const OutboxEntry = z.object({ as: z.string().optional(), envelope: IngestEnvelope });
export type OutboxEntry = z.infer<typeof OutboxEntry>;

export const outboxPath = (): string => join(lbHome(), "outbox.jsonl");

export function appendOutbox(entry: OutboxEntry): void {
  try {
    mkdirSync(lbHome(), { recursive: true });
    appendFileSync(outboxPath(), `${JSON.stringify(entry)}\n`);
  } catch {
    // the outbox is best effort; the hook still fails open
  }
}

const MAX_PER_FLUSH = 50;

/**
 * Claims the outbox with an atomic rename so concurrent hooks never send the same event twice,
 * then re-appends whatever could not be delivered.
 */
export async function flushOutbox(send: (e: OutboxEntry) => Promise<void>): Promise<number> {
  const claimed = `${outboxPath()}.${process.pid}.flushing`;
  try {
    renameSync(outboxPath(), claimed);
  } catch {
    return 0;
  }
  let lines: string[] = [];
  try {
    lines = readFileSync(claimed, "utf8").split("\n").filter(Boolean);
  } finally {
    rmSync(claimed, { force: true });
  }
  const entries = lines.flatMap((l) => {
    try {
      return [OutboxEntry.parse(JSON.parse(l))];
    } catch {
      return [];
    }
  });
  const now = entries.slice(0, MAX_PER_FLUSH);
  const later = entries.slice(MAX_PER_FLUSH);
  const results = await Promise.allSettled(now.map(send));
  let sent = 0;
  results.forEach((r, i) => {
    const e = now[i];
    if (r.status === "fulfilled") sent++;
    else if (e) appendOutbox(e);
  });
  for (const e of later) appendOutbox(e);
  return sent;
}
