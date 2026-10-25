import { tokens } from "./lexical";
import { symbolName } from "./touches";
import type { ClassifiedNode } from "./types";

// Signals that separate plan-vs-plan relations (duplicate, contradiction, ordering) where no code exists yet.

const NEG =
  /\b(remov|delet|drop|disabl|deprecat|revert|disallow|replac|stop|avoid|rip|kill|forbid|reject|turn(?:ing)? off|migrat\w* (?:away|off))\w*/i;
const POS =
  /\b(add|enabl|introduc|implement|support|extend|keep|allow|creat|turn(?:ing)? on|adopt|switch\w* to)\w*/i;
const DEPENDS =
  /\b(depends? on|requires?|blocked by|builds? on|stacked on|on top of|once .{0,40}\b(lands?|merged?|exists?)|after .{0,40}\b(lands?|merged?)|is (?:adding|writing|creating)|teammate|being added|don'?t (?:write|create|define) (?:it|your own))/i;

export const polarity = (text: string): { neg: boolean; pos: boolean } => ({
  neg: NEG.test(text),
  pos: POS.test(text),
});

/** Content words both texts use: the shared "what" of two plans. */
export function sharedNouns(a: string, b: string): number {
  const tb = tokens(b);
  let n = 0;
  for (const t of tokens(a)) if (tb.has(t)) n += 1;
  return n;
}

/** One plan takes away (remove / disable / drop) what the other builds up (add / enable / keep), on a shared noun. */
export function polarityOpposed(a: string, b: string): boolean {
  if (sharedNouns(a, b) === 0) return false;
  const pa = polarity(a);
  const pb = polarity(b);
  return (pa.neg && !pb.neg && pb.pos) || (pb.neg && !pa.neg && pa.pos);
}

export const dependencyCue = (text: string): boolean => DEPENDS.test(text);

/** Names a node points at: symbol names and file basenames (without extension), lower-cased. */
function targets(n: ClassifiedNode, created: boolean): Set<string> {
  const out = new Set<string>();
  for (const t of n.touches) {
    if (created && t.op !== "create") continue;
    if (t.symbol) out.add(symbolName(t.symbol).toLowerCase());
    const base = t.path
      .split("/")
      .pop()
      ?.replace(/\.\w+$/, "");
    if (base && base.length >= 4) out.add(base.toLowerCase());
  }
  return out;
}

/** `text` names something `n` touches (or creates): "use requireAdmin, which a teammate is adding". */
export function mentions(text: string, n: ClassifiedNode, created = false): boolean {
  const lower = text.toLowerCase();
  for (const t of targets(n, created)) if (t.length >= 4 && lower.includes(t)) return true;
  return false;
}
