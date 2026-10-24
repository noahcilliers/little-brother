import type { Doc } from "../_generated/dataModel";

// Short labels for graph glyphs and one-sentence notes for the side panel, derived from compact signatures
// (`VERB topic target → OUTCOME`, docs/PLAN.md §2) without any model call.

type Sig = Pick<Doc<"nodes">, "verb" | "text" | "topic" | "files">;

const STOP = new Set("the a an to so and of for that it with in on can".split(" "));
const PAST: Record<string, string> = {
  EDIT: "Edited",
  FIX: "Fixed",
  REVERT: "Reverted",
  RUN: "Ran",
  TEST: "Ran",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

/** The signature without its verb, topic and outcome tail: the free target text. */
export function signatureRest(n: Sig): string {
  return n.text
    .split(/\s+/)
    .filter((w, i) => !(i === 0 && w === n.verb) && w !== n.topic && w !== `${n.topic}:`)
    .join(" ")
    .replace(/\s*→.*$/, "")
    .trim();
}

function outcomeTail(text: string): string {
  return text.match(/→\s*(.*)$/)?.[1]?.trim() ?? "";
}

/** "PLAN build the user auth workflow" → "Build user auth". The full text goes to the side panel. */
export function intentLabel(n: Sig): string {
  const head = signatureRest(n).split(/[:;,.]/)[0] ?? "";
  const words = head.split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()));
  return capitalize(clip(words.slice(0, 3).join(" ") || n.topic || "intent", 28));
}

export function actionLabel(n: Sig): string {
  const file = n.files[0];
  return clip(file ? basename(file) : signatureRest(n) || n.verb.toLowerCase(), 24);
}

/** "DECIDE auth.mechanism jwt-bearer" and "DECIDE api.cors = x" both read "topic = choice". */
export function decisionLabel(n: Sig): string {
  const rest = signatureRest(n).replace(/^=\s*/, "");
  return clip(n.topic ? `${n.topic} = ${rest}` : rest, 26);
}

export function lessonLabel(n: Sig): string {
  return n.topic ? `${n.topic} lesson` : "lesson";
}

export function intentNote(n: Sig): string {
  return capitalize(signatureRest(n));
}

export function actionNote(n: Sig): string {
  const rest = signatureRest(n);
  const tail = outcomeTail(n.text);
  const did = `${PAST[n.verb] ?? capitalize(n.verb.toLowerCase())} ${rest}`;
  const how = n.verb === "TEST" && tail === "OK" ? "tests pass" : tail && tail !== "OK" ? tail : "";
  return [did, n.topic, how].filter(Boolean).join(" · ");
}

export function knowledgeNote(n: Sig): string {
  return n.text.replace(new RegExp(`^${n.verb}\\s+`), "");
}

/** The line of a failing command's output that says why: an error message first, then a test arrow line. */
export function failureLine(tail: string): string | undefined {
  const lines = tail
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const error = lines.find((l) => /\b\w*Error:/.test(l));
  if (error) return clip(error.replace(/^.*?\b\w*Error:\s*/, ""), 160);
  const arrow = lines.find((l) => l.startsWith("→"));
  if (arrow) return clip(arrow.replace(/^→\s*/, ""), 160);
  const failed = lines.find((l) => /fail/i.test(l));
  return failed ? clip(failed, 160) : undefined;
}

export function verdictNote(reason: string): string {
  return reason.replace(/^\[little-brother\]\s*/, "").split("\n")[0] ?? reason;
}
