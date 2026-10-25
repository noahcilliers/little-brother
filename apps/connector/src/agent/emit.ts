import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AgentEvent } from "@lb/core";

export type Emit = (e: AgentEvent) => void;

/** JSONL on stdout for the eval harness; the tail of long texts is cut so one line stays readable. */
export function stdoutEmitter(write: (line: string) => void = (l) => process.stdout.write(l)): Emit {
  return (e) => write(`${JSON.stringify(e)}\n`);
}

/** Appends Claude-Code-shaped transcript entries; a failed write never stops the agent. */
export function transcriptWriter(path: string): (entry: Record<string, unknown>) => void {
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    // the first append reports nothing either; usage then just isn't counted
  }
  return (entry) => {
    try {
      appendFileSync(path, `${JSON.stringify({ ...entry, timestamp: new Date().toISOString() })}\n`);
    } catch {
      // as above
    }
  };
}
