export const NODE_KINDS = ["knowledge", "intent", "action"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const OUTCOMES = ["open", "succeeded", "failed", "superseded"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Seed rows for the `verbs` table. Matching is data-driven; see core/verbs.ts. */
export type VerbRule = { tool?: string; input?: string; after?: string; outcome?: "ok" | "fail" };
export type VerbDef = { key: string; description: string; match: VerbRule[]; priority: number };

export const SEED_VERBS: VerbDef[] = [
  {
    key: "TEST",
    description: "Run tests or a build",
    priority: 90,
    match: [{ tool: "^Bash$", input: "\\b(vitest|jest|pytest|mocha|playwright|tsc|test|build)\\b" }],
  },
  {
    key: "FIX",
    description: "Edit after a failed run",
    priority: 80,
    match: [{ tool: "^(Edit|Write|MultiEdit)$", after: "FAIL" }],
  },
  {
    key: "EDIT",
    description: "Change a file",
    priority: 50,
    match: [{ tool: "^(Edit|Write|MultiEdit|NotebookEdit)$" }],
  },
  {
    key: "EXPLORE",
    description: "Read or search",
    priority: 40,
    match: [{ tool: "^(Read|Grep|Glob|LS|WebFetch|WebSearch)$" }],
  },
  { key: "RUN", description: "Run a command", priority: 30, match: [{ tool: "^Bash$" }] },
  { key: "PLAN", description: "State an intent", priority: 0, match: [] },
  { key: "REVERT", description: "Restore earlier content", priority: 0, match: [] },
  { key: "DECIDE", description: "Choose a topic value", priority: 0, match: [] },
  { key: "LEARN", description: "Distilled knowledge", priority: 0, match: [] },
];
export const FALLBACK_VERB = "ACT";

/** Compact signature line: `VERB topic target → OUTCOME`. */
export function signatureLine(p: {
  verb: string;
  topic?: string;
  target?: string;
  outcome?: Outcome;
}): string {
  const tail = p.outcome === "failed" ? " → FAIL" : p.outcome === "succeeded" ? " → OK" : "";
  return [p.verb, p.topic, p.target].filter(Boolean).join(" ") + tail;
}

/** Normalize a shell command so retries of the same thing hash identically. */
export function normalizeCommand(cmd: string): string {
  return cmd
    .replace(/\s+/g, " ")
    .replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, "STR")
    .replace(/\b\d+\b/g, "N")
    .trim();
}
