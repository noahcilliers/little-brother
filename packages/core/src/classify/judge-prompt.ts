import { z } from "zod";
import type { Verdict } from "./decide";
import { type CandidatePair, type ClassifiedNode, type Hint, RELATIONS } from "./types";

/** Contract 5: what the LLM must return. Anything else becomes a fallback judgment. */
export const JudgeOutput = z.object({
  relation: z.enum(RELATIONS),
  direction: z.enum(["new_needs_other", "other_needs_new", "none"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(600),
});
export type JudgeOutput = z.infer<typeof JudgeOutput>;

const LenientJudgeOutput = z.object({
  relation: z.enum(RELATIONS),
  direction: z.enum(["new_needs_other", "other_needs_new", "none"]).catch("none"),
  confidence: z.number().min(0).max(1).default(0.7), // missing → default; out of range → reject
  rationale: z.string().catch("no rationale given"),
});

/** Same schema as JSON Schema, for providers that constrain decoding. */
export const JUDGE_JSON_SCHEMA = {
  type: "object",
  properties: {
    relation: { type: "string", enum: [...RELATIONS] },
    direction: { type: "string", enum: ["new_needs_other", "other_needs_new", "none"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    rationale: { type: "string" },
  },
  required: ["relation", "direction", "confidence", "rationale"],
  additionalProperties: false,
} as const;

export const JUDGE_SYSTEM = `You classify how two pieces of work by coding agents on the same repo relate.
Return one JSON object: {"relation", "direction", "confidence", "rationale"}.

Relations (pick exactly one):
- independent: no meaningful interaction. e.g. docs edit vs DB migration.
- overlap_compatible: same area, no problem. e.g. two agents add separate functions to utils.ts.
- duplicate: the same task or change done twice. e.g. both "add retry to the HTTP client".
- textual_conflict: git cannot merge them. e.g. both create db/schema/users.ts.
- semantic_conflict: merges cleanly but breaks behavior. e.g. A changes pay(amount) to pay(amount, currency); B adds pay(amount) callers.
- intent_contradiction: goals pull in opposite directions. e.g. A removes legacy auth; B extends it.
- ordering_dependency: one must land before the other, and nothing is broken once it does. e.g. B uses User.role, which A is creating. NOT when A changes or replaces something B already relies on: that is semantic_conflict.
- repeats_failure: NEW follows a path already recorded as failed in OTHER. e.g. NEW plans CORS middleware that OTHER proved fails.

direction: "new_needs_other" if NEW depends on or must adapt to OTHER, "other_needs_new" for the reverse, else "none".
confidence: 0..1, how sure you are. Similar wording alone is not evidence; "add X" and "remove X" are not duplicates.

Decision rule: if OTHER's code depends on behavior that NEW changes or replaces (a token format, a session/cookie,
a header, a field, a function signature, a route), merging both breaks OTHER at runtime: semantic_conflict, even
if each passes its own tests. Use intent_contradiction when the goals themselves oppose.

Judge what would happen if BOTH changes were merged into one codebase. Only call it a conflict if you can name the
specific symbol, request field, header, cookie, route or file where one change breaks the other; otherwise prefer
independent or overlap_compatible. A FIX that undoes an earlier change restores the original code. Two agents
converging on the same working solution is duplicate or overlap_compatible, never a conflict.
rationale: 1-3 sentences citing specific files, symbols or commands.`;

function describe(n: ClassifiedNode): string {
  const touches = n.touches
    .slice(0, 8)
    .map(
      (t) =>
        `${t.op} ${t.path}${t.symbol ? `::${t.symbol.split("::").pop()}` : ""}${t.lines ? ` L${t.lines[0]}-${t.lines[1]}` : ""}`,
    );
  return [
    `kind=${n.kind} verb=${n.verb} outcome=${n.outcome}${n.topic ? ` topic=${n.topic}` : ""}`,
    `signature: ${n.text}`,
    n.preview ? `code:\n${n.preview.split("\n").slice(0, 25).join("\n")}` : "",
    touches.length ? `touches: ${touches.join("; ")}` : "",
    n.references.length ? `references: ${n.references.slice(0, 10).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The per-pair packet (well under 2k tokens): both nodes, hints, retrieval reasons, past labeled examples. */
export function judgePrompt(pair: CandidatePair, hints: Hint[], examples: string[]): string {
  return [
    `NEW (agent ${pair.next.agentId}):\n${describe(pair.next)}`,
    `OTHER (agent ${pair.other.agentId}${pair.failedMemory ? ", from failure memory" : ", active work"}):\n${describe(pair.other)}`,
    `Retrieved because: ${pair.reasons.join("; ") || "n/a"}`,
    hints.length ? `Rule hints: ${hints.map((h) => `${h.rule} ${h.text}`).join("; ")}` : "",
    examples.length ? `Past judgments with human feedback:\n${examples.map((e) => `- ${e}`).join("\n")}` : "",
    "Answer with the JSON object only.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Parse raw model text into a verdict; null on any schema failure so the caller falls back. */
export function parseJudgeOutput(raw: string, pair: CandidatePair, hints: Hint[]): Verdict | null {
  const body = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  // Strict on what decides (relation), lenient on the rest: a long rationale or a missing confidence from a
  // detailed answer, the conflicts we most want, must not be thrown away as unparseable.
  const parsed = LenientJudgeOutput.safeParse(json);
  if (!parsed.success) return null;
  const o = { ...parsed.data, rationale: parsed.data.rationale.slice(0, 600) };
  return {
    otherNodeId: pair.other.id,
    relation: o.relation,
    direction: o.direction,
    confidence: o.confidence,
    evidence: [
      `judge: ${o.rationale}`,
      ...hints.map((h) => `${h.rule}: ${h.text}`),
      ...pair.reasons.map((r) => `retrieved: ${r}`),
    ],
    source: "llm",
  };
}

/** One few-shot line from a past classification that got human feedback. */
export function exampleLine(e: {
  nextText: string;
  otherText: string;
  relation: string;
  feedback: string;
}): string {
  const verdict =
    e.feedback === "false_positive" ? `NOT ${e.relation} (dismissed)` : `${e.relation} (confirmed)`;
  return `NEW "${e.nextText}" vs OTHER "${e.otherText}" → ${verdict}`;
}
