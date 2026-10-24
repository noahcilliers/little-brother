"use client";

import { useRef } from "react";
import { useCopy } from "@/lib/use-copy";

type Props = { text: string; prompt?: string; className?: string; label?: string };

/** A terminal-style line with a copy button. `prompt` prefixes it ($ for a shell, › for Claude Code). */
export function CopyField({ text, prompt, className, label }: Props) {
  const ref = useRef<HTMLElement>(null);
  const { label: state, copy } = useCopy();
  return (
    <div className={`copy${className ? ` ${className}` : ""}`}>
      {prompt ? (
        <span className="copy-prompt" aria-hidden="true">
          {prompt}
        </span>
      ) : null}
      <code ref={ref} title={text}>
        {text}
      </code>
      <button type="button" aria-label={label ?? `Copy ${text}`} onClick={() => copy(text, ref.current)}>
        {state}
      </button>
    </div>
  );
}
