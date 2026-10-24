import { verbWord } from "./labels";

/** Task-list tools: their calls carry the agent's plan and are not work themselves. */
export const TASK_TOOLS: ReadonlySet<string> = new Set([
  "TaskCreate",
  "TaskUpdate",
  "TodoWrite",
  "TaskGet",
  "TaskList",
]);

/** First sentence of a message, without the `[little-brother]` tag, capped for a one-line note. */
export function firstSentence(text: string, max = 160): string {
  const line =
    text
      .replace(/^\s*\[little-brother\]\s*/, "")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  const m = line.match(/^.*?[.!?](?=\s|$)/);
  const sentence = (m ? m[0] : line).trim();
  return sentence.length > max ? `${sentence.slice(0, max - 1)}…` : sentence;
}

/**
 * Subject of an inferred task (the agent keeps no task list): verb + topic, e.g. "edit api.cors". Without a
 * topic it falls back to the action's own label.
 */
export function inferredSubject(a: { verb: string; topic?: string; label?: string }): string {
  if (a.topic) return `${verbWord(a.verb)} ${a.topic}`;
  return a.label ?? verbWord(a.verb);
}
