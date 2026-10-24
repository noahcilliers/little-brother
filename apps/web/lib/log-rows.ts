import type { LogStep, LogVerdict, ServerRow } from "./api";

// One row shape for every log the app shows: hook arrivals, server decisions and classifier verdicts.

export type LogLevel = "info" | "warn" | "error";
export type LogSource = "hook" | "server" | "classifier";

export type LogRow = {
  id: string;
  at: number;
  level: LogLevel;
  source: LogSource;
  /** Server kind ("attached", "hook · mbp") or the verdict's relation. */
  kind: string;
  who: string;
  session: string | null;
  message: string;
  verdict?: { step: Pick<LogStep, "kind" | "text" | "handle">; v: LogVerdict };
};

export const SOURCE_LABEL: Record<LogSource, string> = {
  hook: "hook",
  server: "server",
  classifier: "classifier",
};

export const DECIDER: Record<LogVerdict["source"], string> = {
  rule: "rule",
  llm: "judge",
  pair_model: "model",
  fallback: "fallback",
};

const levelOf = (v: LogVerdict): LogLevel =>
  v.type === "conflict" ? "error" : v.type === "normal" ? "info" : "warn";
export const relationText = (relation: string) => relation.replace(/_/g, " ");

type Names = (sessionId: string | null | undefined) => string | null;
const none: Names = () => null;

export function fromServer(rows: ServerRow[], name: Names = none): LogRow[] {
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    level: r.level,
    source: r.kind.startsWith("hook") ? "hook" : "server",
    kind: r.kind,
    who: r.who,
    session: name(r.sessionId),
    message: r.text,
  }));
}

/** One row per comparison, so a level filter finds the catches; the step's text leads the message. */
export function fromClassifier(
  steps: (LogStep & { sessionId?: string | null })[],
  name: Names = none,
): LogRow[] {
  return steps.flatMap((step) =>
    step.verdicts.map((v) => ({
      id: v.id,
      at: step.at,
      level: levelOf(v),
      source: "classifier" as const,
      kind: v.relation,
      who: step.handle,
      session: name(step.sessionId),
      message: `${relationText(v.relation)} · ${step.text}${v.against ? `  ↔ @${v.against.handle}` : ""}`,
      verdict: { step: { kind: step.kind, text: step.text, handle: step.handle }, v },
    })),
  );
}

export const newestFirst = (rows: LogRow[]) => [...rows].sort((a, b) => b.at - a.at);

export type LevelFilter = "all" | LogLevel;
export type SourceFilter = "all" | LogSource;
export type LogFilter = { query: string; level: LevelFilter; source: SourceFilter };

export function filterRows(rows: LogRow[], f: LogFilter): LogRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (f.level === "all" || r.level === f.level) &&
      (f.source === "all" || r.source === f.source) &&
      (!q || `${r.message} ${r.who} ${r.kind} ${r.session ?? ""}`.toLowerCase().includes(q)),
  );
}

export const logTime = (at: number) =>
  new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

export const logDate = (at: number) =>
  new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
