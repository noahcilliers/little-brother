"use client";

export type SessionTab = "board" | "log";

const TABS: { id: SessionTab; label: string }[] = [
  { id: "board", label: "Board" },
  { id: "log", label: "Classifier log" },
];

/** Board or the classifier's own record for the same session. */
export function ViewSwitch({ tab, onChange }: { tab: SessionTab; onChange: (t: SessionTab) => void }) {
  return (
    <div className="seg" role="tablist" aria-label="Session view">
      {TABS.map((t) => (
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
