import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { sessionDir } from "./session-file";

// Which Little Brother session each Claude Code session joined. Local only: a Claude session that never
// joined has no file here, and its hooks exit without touching the network.

// `pending`: asked to join and waiting for the room's host; nothing is sent until the host admits it.
const Attachment = z.object({
  code: z.string(),
  name: z.string(),
  room: z.string(),
  pending: z.boolean().optional(),
});
export type Attachment = z.infer<typeof Attachment>;

const fileFor = (claudeSessionId: string) =>
  join(sessionDir(), "attached", `${claudeSessionId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);

export function readAttachment(claudeSessionId: string): Attachment | null {
  if (!claudeSessionId) return null;
  try {
    const parsed = Attachment.safeParse(JSON.parse(readFileSync(fileFor(claudeSessionId), "utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeAttachment(claudeSessionId: string, a: Attachment): void {
  mkdirSync(join(sessionDir(), "attached"), { recursive: true });
  writeFileSync(fileFor(claudeSessionId), JSON.stringify(a));
}

export function clearAttachment(claudeSessionId: string): void {
  rmSync(fileFor(claudeSessionId), { force: true });
}

/** `LB_SESSION=<code> claude` joins every session started from that shell; replay passes it per line. */
export function sessionCodeFor(claudeSessionId: string, override?: string): string | undefined {
  if (override ?? process.env.LB_SESSION) return override ?? process.env.LB_SESSION;
  const a = readAttachment(claudeSessionId);
  return a && !a.pending ? a.code : undefined;
}
