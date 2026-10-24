"use client";

import { useRef } from "react";
import { useCopy } from "@/lib/use-copy";
import { Icon } from "../ui/icon";

/** A short code (session join code) that copies itself when clicked. */
export function CodeChip({ code }: { code: string }) {
  const ref = useRef<HTMLElement>(null);
  const { label: state, copy } = useCopy();
  return (
    <button
      type="button"
      className="code-chip"
      title={state === "copy" ? "Copy join code" : state}
      aria-label={`Copy join code ${code}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        copy(code, ref.current);
      }}
    >
      <code ref={ref}>{code}</code>
      <Icon name={state === "copied" ? "check" : "copy"} size={12} />
    </button>
  );
}
