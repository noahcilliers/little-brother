import { cleanPrompt } from "@lb/core";
import type { Doc } from "../_generated/dataModel";

// Short labels derived from compact signatures (`VERB topic target → OUTCOME`, docs/PLAN.md §2), no model call.

type Sig = Pick<Doc<"nodes">, "verb" | "text" | "topic" | "files" | "touches" | "label">;

const STOP = new Set("the a an to so and of for that it with in on can".split(" "));
const LEAD_VERBS = new Set("add build create issue make use write implement allow set fix".split(" "));

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

/** The signature without its leading verb and topic and its outcome tail: the free target text. */
export function signatureRest(n: Pick<Sig, "verb" | "text" | "topic">): string {
  // Older intents were stored with harness tags (<pasted_content …>) still in the prompt.
  const words = cleanPrompt(n.text.replace(/\s*→.*$/, "")).split(/\s+/);
  if (words[0] === n.verb) words.shift();
  if (n.topic && (words[0] === n.topic || words[0] === `${n.topic}:`)) words.shift();
  return words.join(" ").trim();
}

/** "PLAN auth build the user auth workflow" → "Build user auth". The full prompt goes to the session pane. */
export function goalLabel(n: Sig): string {
  const content = (part: string) => part.split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()));
  // Pasted specs often open with a one-word label ("Title: …"); the goal is the first clause with substance.
  const parts = signatureRest(n).split(/[:;,.]/);
  const words = content(parts.find((p) => content(p).length > 1) ?? parts[0] ?? "");
  return capitalize(clip(words.slice(0, 3).join(" ") || n.topic || "goal", 28));
}

function symbolOf(n: Sig): string | undefined {
  const sym = n.touches.find((t) => t.symbol)?.symbol;
  return sym ? `${sym.split("::").pop()}()` : undefined;
}

/** Verb + primary symbol: "edit issueToken()". Falls back to the file name or the command. */
export function actionLabel(n: Sig): string {
  if (n.label) return n.label;
  const verb = n.verb.toLowerCase();
  const target = symbolOf(n) ?? (n.files[0] ? basename(n.files[0]) : signatureRest(n));
  return clip(`${verb} ${target}`.trim(), 40);
}

/** "DECIDE auth.mechanism jwt-bearer" and "DECIDE api.cors = x" both read "topic = choice". */
export function decisionLabel(n: Sig): string {
  if (n.label) return clip(n.label, 34);
  const rest = signatureRest(n).replace(/^=\s*/, "");
  return clip(n.topic ? `${n.topic.split(".")[0]} = ${rest}` : rest, 30);
}

export function lessonLabel(n: Sig): string {
  const last = n.topic?.split(".").pop();
  if (!last) return "lesson";
  return `${last.length <= 4 ? last.toUpperCase() : last} lesson`;
}

export function knowledgeNote(n: Sig): string {
  const words = n.text.split(/\s+/);
  if (words[0] === n.verb) words.shift();
  if (n.topic && words[0] === n.topic && words[1] !== "=") words.shift();
  return words.join(" ");
}

/** "Issue JWT tokens" → "JWT tokens": the thing a task is about, for captions and keep buttons. */
export function subjectThing(subject: string): string {
  const words = subject.split(/\s+/);
  if (words.length > 1 && LEAD_VERBS.has((words[0] ?? "").toLowerCase())) words.shift();
  return words.join(" ");
}

export function lowerFirst(s: string): string {
  return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** Hook replies start with a "[little-brother]" tag and a "type · " prefix; the panes show the sentence only. */
export function lbSentence(text: string): string {
  const lines = text
    .replace(/^\s*\[little-brother\]\s*/, "")
    .split("\n")
    .map((l) => l.trim().replace(/^(conflict|stale|duplicate|normal)\s*·\s*/i, ""));
  return clip(lines.find(Boolean) ?? text, 220);
}
