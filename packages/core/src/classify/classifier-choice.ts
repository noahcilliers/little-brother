// Which classifier a room runs. Our own model settles the pairs it is sure about in milliseconds; an LLM judge
// handles the rest (or everything, or nothing). Absent = the default: our model, then Gemini.

export const CLASSIFIER_CHOICES = [
  "model+gemini",
  "model+claude",
  "gemini",
  "claude",
  "model",
  "rules",
] as const;
export type ClassifierChoice = (typeof CLASSIFIER_CHOICES)[number];
export const DEFAULT_CLASSIFIER: ClassifierChoice = "model+gemini";

export type ClassifierPlan = { pairModel: boolean; judge: "gemini" | "claude" | "none" };

export function classifierPlan(choice: ClassifierChoice | undefined): ClassifierPlan {
  switch (choice ?? DEFAULT_CLASSIFIER) {
    case "model+gemini":
      return { pairModel: true, judge: "gemini" };
    case "model+claude":
      return { pairModel: true, judge: "claude" };
    case "gemini":
      return { pairModel: false, judge: "gemini" };
    case "claude":
      return { pairModel: false, judge: "claude" };
    case "model":
      return { pairModel: true, judge: "none" };
    case "rules":
      return { pairModel: false, judge: "none" };
  }
}

/** The stored choice for a first pass (our model or rules alone) and an escalation judge: the settings UI's two steps. */
export function classifierChoiceOf(plan: ClassifierPlan): ClassifierChoice {
  if (plan.judge === "none") return plan.pairModel ? "model" : "rules";
  return plan.pairModel ? `model+${plan.judge}` : plan.judge;
}
