import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type Ctx = Pick<QueryCtx, "db">;
export type Klass = Doc<"classifications">;

export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/** Event payloads are stored as-is (`v.any()`), so every field is read defensively. */
export function payloadField(e: Doc<"events">, ...path: string[]): unknown {
  let cur: unknown = e.payload;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

export function payloadString(e: Doc<"events">, ...path: string[]): string | undefined {
  const v = payloadField(e, ...path);
  return typeof v === "string" ? v : undefined;
}
