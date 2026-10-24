import { z } from "zod";

/** Claude Code's AskUserQuestion input, as the PreToolUse hook receives it. */
export const AskInput = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        header: z.string().optional(),
        multiSelect: z.boolean().optional(),
        options: z.array(z.object({ label: z.string(), description: z.string().optional() })).default([]),
      }),
    )
    .min(1),
});
export type AskInput = z.infer<typeof AskInput>;

export type AskAnswer = { question: string; selected: string[]; other?: string };

/**
 * The denial reason that hands the developer's dashboard answers back to the agent. The tool never runs, so
 * the wording must make the agent treat this as the answer rather than retry the question in the terminal.
 */
export function askReply(answers: AskAnswer[]): string {
  const lines = answers.map((a) => {
    const picked = [...a.selected, ...(a.other ? [a.other] : [])];
    return `- ${a.question} → ${picked.length ? picked.join("; ") : "(no answer)"}`;
  });
  return [
    "[little-brother] The user answered your questions on the Little Brother dashboard. These are their answers; continue with them and don't ask again:",
    ...lines,
  ].join("\n");
}
