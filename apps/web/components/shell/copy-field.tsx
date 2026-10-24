"use client";

import { useRef } from "react";
import { useCopy } from "@/lib/use-copy";
import { Icon } from "../ui/icon";

type Props = { text: string; prompt?: string; className?: string; label?: string; size?: "md" | "lg" };

/** A terminal-style line with a copy button. `prompt` prefixes it ($ for a shell, › for Claude Code). */
export function CopyField({ text, prompt, className, label, size = "md" }: Props) {
  const ref = useRef<HTMLElement>(null);
  const { label: state, copy } = useCopy();
  const cls = ["copy", size === "lg" ? "copy-lg" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      {prompt ? (
        <span className="copy-prompt" aria-hidden="true">
          {prompt}
        </span>
      ) : null}
      <code ref={ref} title={text}>
        {text}
      </code>
      <button
        type="button"
        aria-label={label ?? `Copy ${text}`}
        title={state === "copy" ? "Copy" : state}
        onClick={() => copy(text, ref.current)}
      >
        <Icon name={state === "copied" ? "check" : "copy"} size={14} />
      </button>
    </div>
  );
}
