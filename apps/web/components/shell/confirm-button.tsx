"use client";

import { useState } from "react";

type Props = { label: string; confirm: string; busy?: boolean; danger?: boolean; onConfirm: () => void };

/** Two clicks for anything destructive; the second click is the only one that acts. */
export function ConfirmButton({ label, confirm, busy, danger, onConfirm }: Props) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type="button" className="btn-ghost" onClick={() => setAsking(true)} disabled={busy}>
        {label}
      </button>
    );
  return (
    <span className="confirm">
      <span>{confirm}</span>
      <button
        type="button"
        className={danger ? "btn-ghost danger" : "btn-ghost"}
        disabled={busy}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        Yes
      </button>
      <button type="button" className="btn-ghost" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}
