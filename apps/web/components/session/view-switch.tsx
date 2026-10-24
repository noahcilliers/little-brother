"use client";

export type SessionTab = "board" | "log" | "server";

const TABS: { id: SessionTab; label: string }[] = [
  { id: "board", label: "Board" },
  { id: "log", label: "Classifier log" },
  { id: "server", label: "Server log" },
];

/** Board, the classifier's own record, or (for the host) the server log, for the same session. */
export function ViewSwitch({
  tab,
  onChange,
  host,
}: {
  tab: SessionTab;
  onChange: (t: SessionTab) => void;
  /** The server log is the host's. */
  host: boolean;
}) {
  return (
    <div className="seg" role="tablist" aria-label="Session view">
      {TABS.filter((t) => host || t.id !== "server").map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          className={tab === t.id ? "on" : undefined}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
