"use client";

import { useRef } from "react";
import { useCopy } from "@/lib/use-copy";

/** A short code (session join code) that copies itself when clicked. */
export function CodeChip({ code, label = "code" }: { code: string; label?: string }) {
  const ref = useRef<HTMLElement>(null);
  const { label: state, copy } = useCopy(label);
  return (
    <button
      type="button"
      className="chip-code"
      title="Copy the join code"
      onClick={() => copy(code, ref.current)}
    >
      <span className="chip-k">{state}</span>
      <code ref={ref}>{code}</code>
    </button>
  );
}
