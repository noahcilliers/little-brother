import type { Rule } from "../types";
import { settle } from "./settle";

/**
 * R11: a new plan on a topic that already has a failed lesson. Warn-level only (plans are guesses and intent
 * actions are capped), so it can't block anyone; it puts the lesson in front of the agent before the first edit.
 */
export const r11IntentTopicFailed: Rule = {
  id: "R11",
  check(pair) {
    const { next, other } = pair;
    if (next.kind !== "intent" || !next.topic || other.topic !== next.topic) return null;
    // Lessons keep "→ FAIL" for the attempt even when a later fix worked (outcome "succeeded").
    const recordsFailure = other.outcome === "failed" || other.text.includes("→ FAIL");
    if (other.kind !== "knowledge" || !recordsFailure) return null;
    return settle(pair, "R11", "repeats_failure", "new_needs_other", 0.8, [
      `already tried on ${next.topic}: ${other.text}`,
    ]);
  },
};
