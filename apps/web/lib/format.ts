export function clock(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Elapsed time since the board's first node, as m:ss. */
export function elapsed(at: number, start: number): string {
  const s = Math.max(0, Math.floor((at - start) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function agentColor(index: number | undefined): string {
  return index ? `var(--agent-${index})` : "var(--ink)";
}
