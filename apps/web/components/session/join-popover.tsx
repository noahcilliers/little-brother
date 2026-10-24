"use client";

import { useEffect, useRef, useState } from "react";
import { JoinCommands } from "./join-commands";

/** Header button: how another teammate joins, without leaving the board. */
export function JoinPopover({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="popover-anchor" ref={ref}>
      <button type="button" className="btn-ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
        How to join
      </button>
      {open ? (
        <div className="popover" role="dialog" aria-label="How to join this session">
          <JoinCommands code={code} />
          <a className="muted small" href="/start#connect">
            New laptop? Connect it first →
          </a>
        </div>
      ) : null}
    </div>
  );
}
