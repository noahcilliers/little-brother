"use client";

import { useState } from "react";

/** Copy to the clipboard with a short-lived label; falls back to selecting the text when blocked. */
export function useCopy(idle = "copy") {
  const [label, setLabel] = useState(idle);
  const flash = (msg: string) => {
    setLabel(msg);
    setTimeout(() => setLabel(idle), 1400);
  };
  const copy = (text: string, target: HTMLElement | null) => {
    const select = () => {
      if (!target) return flash("select it");
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      flash("selected");
    };
    if (!navigator.clipboard) return select();
    navigator.clipboard.writeText(text).then(() => flash("copied"), select);
  };
  return { label, copy };
}
