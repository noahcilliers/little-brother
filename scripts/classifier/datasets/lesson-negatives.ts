import {
  type ClassifiedNode,
  type LabelledPair,
  lexicalSimilarity,
  negativeRelation,
} from "../../../packages/core/src/index";
import { intentPair } from "./intent-pair";

// Every repeats_failure positive pairs a plan with a failure lesson, so without these the model would learn
// "any lesson means a repeat". Each plan is also paired with the most similar lessons about OTHER work (the
// lessons failure memory would retrieve for it), labelled as not a repeat.

/** `room`: failure memory is per room (repository), so only lessons from the same one are candidates. */
export type LessonCase = {
  id: string;
  group: string;
  room: string;
  plan: ClassifiedNode;
  lesson: ClassifiedNode;
};

export function lessonNegatives(
  cases: LessonCase[],
  perPlan = 2,
  source = "lesson-negative",
): LabelledPair[] {
  const out: LabelledPair[] = [];
  for (const c of cases) {
    const others = cases
      .filter((o) => o.room === c.room && o.id !== c.id && o.lesson.text !== c.lesson.text)
      .map((o) => ({ o, s: lexicalSimilarity(c.plan.text, o.lesson.text) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, perPlan);
    for (const { o } of others) {
      const row = intentPair(
        `${c.id}~${o.id}:lesson-negative`,
        c.group,
        c.plan,
        { ...o.lesson, id: `${o.lesson.id}~${c.id}` },
        (f: number[]) => ({ relation: negativeRelation(f), origin: "dataset" }),
        { source, repo: c.group, level: "intent" },
      );
      if (row) out.push(row);
    }
  }
  return out;
}
