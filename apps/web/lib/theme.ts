"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "auto" | "light" | "dark";

/** Theme lives on <html data-theme>; absent means follow the OS. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>("auto");
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === "light" || t === "dark") setChoice(t);
  }, []);
  const toggle = () => {
    const root = document.documentElement;
    const effective =
      root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = effective === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    setChoice(next);
    try {
      localStorage.setItem("lb-theme", next);
    } catch {
      // Private mode or blocked storage: the toggle still works for this page view.
    }
  };
  return { choice, toggle };
}
