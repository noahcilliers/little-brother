import type { Rule } from "../types";
import { settle } from "./settle";

/** R10: exact match with the signature of an action or lesson already recorded as failed. */
export const r10FailedSignature: Rule = {
  id: "R10",
  check(pair) {
    const { next, other } = pair;
    if (!next.signature || next.signature !== other.signature) return null;
    // Re-running a test or command after changing code is the normal loop, not a repeated approach.
    if (/^(RUN|TEST)$/.test(next.verb)) return null;
    const failed = other.outcome === "failed" || other.kind === "knowledge";
    if (!failed) return null;
    return settle(pair, "R10", "repeats_failure", "new_needs_other", 0.95, [
      `exact repeat of a known-failing edit: ${other.text}`,
    ]);
  },
};
