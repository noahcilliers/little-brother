"use client";

import { useEffect, useRef } from "react";
import { selectedDetail } from "./selected-detail";
import type { DetailProps } from "./task-detail";

type Props = DetailProps & {
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Another dialog (a decision) is on top: Esc belongs to it. */
  covered: boolean;
};

/**
 * What was clicked on the board, over the board: a centred card on desktop, a bottom sheet on phones. Esc, the
 * close button or a press outside closes it and clears the selection.
 */
export function TaskPopup({ selected, onSelect, covered, ...detail }: Props) {
  const card = useRef<HTMLDivElement>(null);
  const shown = selectedDetail({ ...detail, selected, onSelect });
  const open = shown !== null;

  useEffect(() => {
    if (!open || covered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSelect(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, covered, onSelect]);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement;
    card.current?.focus({ preventScroll: true });
    return () => {
      if (before instanceof HTMLElement) before.focus({ preventScroll: true });
    };
  }, [open]);

  if (!shown) return null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a press outside closes; Esc and × are the keyboard paths
    <div
      className="sel-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      <div
        ref={card}
        className="sel-pop card"
        role="dialog"
        aria-modal="true"
        aria-label={shown.kind}
        tabIndex={-1}
      >
        <header className="sel-head">
          <span>{shown.kind}</span>
          <button type="button" className="sel-close" aria-label="Close" onClick={() => onSelect(null)}>
            ×
          </button>
        </header>
        <div className="detail">{shown.body}</div>
      </div>
    </div>
  );
}
