export type VerdictType = "conflict" | "duplicate" | "stale" | "normal";
export type Outcome = "open" | "succeeded" | "failed" | "superseded";

export function clock(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const OUTCOME_TAIL: Record<Outcome, string> = {
  open: "",
  succeeded: "→ OK",
  failed: "→ FAIL",
  superseded: "→ SUPERSEDED",
};

/** Split a node's compact signature into the two lines a graph node shows. */
export function signatureLines(n: {
  verb: string;
  topic?: string;
  text: string;
  files: string[];
  outcome: Outcome;
}) {
  const rest = n.text
    .split(/\s+/)
    .filter((w, i) => !(i === 0 && w === n.verb) && w !== n.topic)
    .join(" ")
    .replace(/\s*→.*$/, "");
  const target = rest || n.files[0] || "";
  return { head: n.topic ?? "", target: [target, OUTCOME_TAIL[n.outcome]].filter(Boolean).join("  ") };
}
