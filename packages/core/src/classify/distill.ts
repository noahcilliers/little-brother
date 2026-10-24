import type { ClassifiedNode } from "./types";

export type TrajectoryStep = Pick<
  ClassifiedNode,
  "verb" | "text" | "outcome" | "signature" | "topic" | "at"
> & {
  files: string[];
  /** Tail of the failing command's output, when the hook captured one. */
  output?: string;
};

export type Lesson = {
  text: string;
  topic?: string;
  files: string[];
  outcome: "failed" | "succeeded";
  signature?: string;
  /** Raw material for an LLM rewrite of `text`. */
  tried: string[];
  why?: string;
  worked: string[];
};

const RECOVERY_VERBS = new Set(["FIX", "TEST", "RUN"]);
const CHANGE_VERBS = new Set(["FIX", "EDIT"]);
const MAX_TEXT = 280;

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** The most explanatory line of a failure's output: an assertion message or error, not the exit code. */
export function failureReason(output: string | undefined): string | undefined {
  if (!output) return undefined;
  const lines = output
    .split("\n")
    .map((l) => l.replace(/^[\s→×✗❯>|-]+/, "").trim())
    .filter((l) => l && !/^exit code/i.test(l) && !/^(RUN|Test Files|Tests|Duration|Start at)\b/.test(l));
  const best =
    lines.find((l) => /reject|refuse|denied|not allowed|cannot|can't|invalid|error:/i.test(l)) ?? lines[0];
  return best ? clip(best.replace(/:\s*expected\b.*$/, ""), 120) : undefined;
}

/**
 * Deterministic "what was tried → why it failed → what worked" from a trajectory's action signatures.
 * The lesson carries the signature of the change that was tried (not of the failing test run), so an
 * exact repeat of that change is what R10 catches. Null when nothing failed.
 */
export function distillTrajectory(intent: TrajectoryStep, actions: TrajectoryStep[]): Lesson | null {
  const steps = [...actions].sort((a, b) => a.at - b.at);
  const failures = steps.filter((s) => s.outcome === "failed");
  const firstFail = failures[0];
  const lastFail = failures[failures.length - 1];
  if (!firstFail || !lastFail) return null;
  const before = steps.filter((s) => s.at < firstFail.at && CHANGE_VERBS.has(s.verb));
  const attempt = CHANGE_VERBS.has(firstFail.verb) ? firstFail : (before[before.length - 1] ?? firstFail);
  const after = steps.filter((s) => s.at > lastFail.at);
  const recovered = after.some((s) => RECOVERY_VERBS.has(s.verb) && s.outcome === "succeeded");
  const workedSteps = recovered ? after.filter((s) => CHANGE_VERBS.has(s.verb)) : [];
  const worked = workedSteps.map((s) => s.text);
  const tried = [...new Set([attempt.text, ...failures.map((f) => f.text)])];
  const why = failureReason(failures.find((f) => f.output)?.output);
  const topic = attempt.topic ?? firstFail.topic ?? intent.topic;
  const files = [...new Set([attempt, ...failures, ...workedSteps].flatMap((s) => s.files))].slice(0, 20);
  const attempts = failures.length > 1 ? ` (${failures.length} failures)` : "";
  const text = clip(
    [
      `LEARN${topic ? ` ${topic}` : ""}: tried ${attempt.text.replace(/ → (OK|FAIL)$/, "")}${attempts} → FAIL`,
      why ? `: ${why}` : "",
      worked.length ? ` → worked: ${worked.slice(-2).join("; ")}` : "",
    ].join(""),
    MAX_TEXT,
  );
  const signature = attempt.signature ?? failures.find((f) => f.signature)?.signature;
  return {
    text,
    ...(topic ? { topic } : {}),
    files,
    outcome: recovered ? "succeeded" : "failed",
    ...(signature ? { signature } : {}),
    tried,
    ...(why ? { why } : {}),
    worked,
  };
}

export function distillPrompt(intent: TrajectoryStep, lesson: Lesson): string {
  return [
    "Summarize this coding-agent trajectory as ONE line under 200 characters, in the form",
    '"tried X → failed because Y → worked: Z" (omit "worked" if nothing worked). Name files, commands and symbols.',
    `Goal: ${intent.text}`,
    `Failed steps: ${lesson.tried.join(" | ")}`,
    lesson.why ? `Failure output: ${lesson.why}` : "",
    lesson.worked.length ? `Steps after recovery: ${lesson.worked.join(" | ")}` : "No recovery.",
    "Reply with the line only.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Accept an LLM rewrite only if it is one short line that still marks the failure ("→ FAIL" is what
 * failure-memory lookups key on); otherwise keep the deterministic text.
 */
export function acceptDistilled(raw: string | null, lesson: Lesson): string {
  const line = (raw?.trim().split("\n")[0]?.trim() ?? "").replace(/→\s*failed\b/i, "→ FAIL");
  if (line.length < 10 || line.length > MAX_TEXT || !/\bFAIL\b/.test(line)) return lesson.text;
  return line.startsWith("LEARN") ? line : `LEARN${lesson.topic ? ` ${lesson.topic}` : ""}: ${line}`;
}
