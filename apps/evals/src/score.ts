import type { EvalCase, Expectation, FindingType } from "./case";

/** One classification row the backend stored for this run's session. */
export type Finding = {
  id: string;
  type: string;
  relation: string;
  action: string;
  source: string;
  agents: string[];
  at: number;
  reason: string;
};

export type AgentTiming = { handle: string; startedAt: number | null; firstEditAt: number | null };
export type CheckResult = { id: string; value: boolean; detail: string };

export type Outcome = "hit" | "mislabel" | "miss" | "unmaterialized";

export type ExpectationScore = {
  agents: [string, string];
  type: FindingType;
  relation?: string;
  outcome: Outcome;
  materialized: boolean;
  row?: Pick<Finding, "id" | "type" | "relation" | "action" | "source" | "at">;
  /** Seconds from the later agent's prompt to the row. */
  detectSec?: number;
  /** The row existed before the later agent's first successful edit (or it never edited). */
  beforeFirstEdit?: boolean;
};

export type FalsePositive = { agents: string[]; types: string[]; rows: number; reason: string };

export type RunScore = {
  control: boolean;
  expectations: ExpectationScore[];
  falsePositives: FalsePositive[];
};

export const pairKey = (agents: readonly string[]): string => [...new Set(agents)].sort().join("+");

/** `normal` rows record a checked pair, not a finding. */
export const isFinding = (f: Finding): boolean => f.type !== "normal";

function scoreExpectation(
  e: Expectation,
  rows: Finding[],
  timing: Map<string, AgentTiming>,
  checks: Map<string, CheckResult>,
): ExpectationScore {
  const materialized = e.evidence.some((id) => checks.get(id)?.value === true);
  const byTime = [...rows].sort((a, b) => a.at - b.at);
  const row = byTime.find((r) => r.type === e.type) ?? byTime[0];
  const base = {
    agents: e.agents,
    type: e.type,
    ...(e.relation ? { relation: e.relation } : {}),
    materialized,
  };
  if (!row) return { ...base, outcome: materialized ? "miss" : "unmaterialized" };
  const [a, b] = e.agents.map((h) => timing.get(h));
  const later = [a, b]
    .filter((t) => t?.startedAt != null)
    .sort((x, y) => (y?.startedAt ?? 0) - (x?.startedAt ?? 0))[0];
  const detectSec = later?.startedAt != null ? (row.at - later.startedAt) / 1000 : undefined;
  const beforeFirstEdit = later ? later.firstEditAt == null || row.at <= later.firstEditAt : undefined;
  return {
    ...base,
    outcome: row.type === e.type ? "hit" : "mislabel",
    row: {
      id: row.id,
      type: row.type,
      relation: row.relation,
      action: row.action,
      source: row.source,
      at: row.at,
    },
    ...(detectSec !== undefined ? { detectSec } : {}),
    ...(beforeFirstEdit !== undefined ? { beforeFirstEdit } : {}),
  };
}

/**
 * Scores one run. Rows are grouped by agent pair: a group on an expected pair is a hit (right type) or a
 * mislabel; a group on any other pair is one false positive, however many rows it holds.
 */
export function scoreRun(
  c: EvalCase,
  findings: Finding[],
  agents: AgentTiming[],
  checks: CheckResult[],
): RunScore {
  const rows = findings.filter(isFinding);
  const groups = new Map<string, Finding[]>();
  for (const r of rows) groups.set(pairKey(r.agents), [...(groups.get(pairKey(r.agents)) ?? []), r]);
  const timing = new Map(agents.map((t) => [t.handle, t]));
  const checkMap = new Map(checks.map((k) => [k.id, k]));
  const expectedKeys = new Set(c.expect.map((e) => pairKey(e.agents)));
  const expectations = c.expect.map((e) =>
    scoreExpectation(e, groups.get(pairKey(e.agents)) ?? [], timing, checkMap),
  );
  const falsePositives = [...groups]
    .filter(([key]) => !expectedKeys.has(key))
    .map(([, g]) => ({
      agents: [...new Set(g.flatMap((r) => r.agents))].sort(),
      types: [...new Set(g.map((r) => r.type))],
      rows: g.length,
      reason: g[0]?.reason ?? "",
    }));
  return { control: c.expect.length === 0, expectations, falsePositives };
}
