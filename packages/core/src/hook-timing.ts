import { z } from "zod";

/**
 * One `lb hook` call as written to LB_TIMING_FILE (one JSON line each). Times are wall-clock ms measured
 * inside the process: `totalMs` runs from Node's process start to exit, so it includes module loading but
 * not the exec before Node starts; `bootMs` is the part before the hook code ran.
 */
export const HookTiming = z.object({
  event: z.string(),
  tool: z.string().optional(),
  sessionId: z.string().optional(),
  at: z.number(),
  totalMs: z.number(),
  bootMs: z.number(),
  phases: z.record(z.number()),
  delivered: z.boolean(),
  timedOut: z.boolean(),
  error: z.string().optional(),
  /** Characters of hook output the model reads: additional context, a deny reason, a Stop block reason. */
  injectedChars: z.number(),
  decision: z.string().optional(),
});
export type HookTiming = z.infer<typeof HookTiming>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * The text a hook's stdout puts in front of the model. A deny reason reaches the model as the tool result;
 * an allow reason is shown only to the user, so it doesn't count.
 */
export function injectedText(output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const o = output as Record<string, unknown>;
  const parts: string[] = [];
  if (o.decision === "block") parts.push(str(o.reason));
  const h = o.hookSpecificOutput;
  if (h && typeof h === "object") {
    const s = h as Record<string, unknown>;
    parts.push(str(s.additionalContext));
    if (s.permissionDecision === "deny" || s.permissionDecision === "ask")
      parts.push(str(s.permissionDecisionReason));
  }
  return parts.filter(Boolean).join("\n");
}

/** The decision a PreToolUse output carries, if any. */
export function hookDecision(output: unknown): string | undefined {
  if (!output || typeof output !== "object") return undefined;
  const h = (output as Record<string, unknown>).hookSpecificOutput;
  if (!h || typeof h !== "object") return undefined;
  const d = (h as Record<string, unknown>).permissionDecision;
  return typeof d === "string" ? d : undefined;
}

/** Rough English-text token count; reports always label it an estimate. */
export const estimateTokens = (chars: number): number => Math.round(chars / 4);
