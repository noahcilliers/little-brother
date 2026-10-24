"use client";

import { useState } from "react";

/** A shell command with a copy button; falls back to selecting the text when the clipboard is blocked. */
export function CopyCmd({ text, className }: { text: string; className?: string }) {
  const [label, setLabel] = useState("copy");
  const copy = (target: HTMLElement | null) => {
    const done = (msg: string) => {
      setLabel(msg);
      setTimeout(() => setLabel("copy"), 1400);
    };
    const select = () => {
      if (!target) return done("select it");
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      done("selected");
    };
    if (!navigator.clipboard) return select();
    navigator.clipboard.writeText(text).then(() => done("copied"), select);
  };
  return (
    <div className={`cmd${className ? ` ${className}` : ""}`}>
      <code>{text}</code>
      <button
        type="button"
        onClick={(e) => copy(e.currentTarget.previousElementSibling as HTMLElement | null)}
      >
        {label}
      </button>
    </div>
  );
}
