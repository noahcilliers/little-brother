"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "auto" | "light" | "dark";
const NEXT: Record<ThemeChoice, ThemeChoice> = { auto: "light", light: "dark", dark: "auto" };

/** Theme lives on <html data-theme>; absent means follow the OS. The toggle cycles auto → light → dark. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>("auto");
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === "light" || t === "dark") setChoice(t);
  }, []);
  const toggle = () => {
    const next = NEXT[choice];
    const root = document.documentElement;
    if (next === "auto") delete root.dataset.theme;
    else root.dataset.theme = next;
    setChoice(next);
    try {
      if (next === "auto") localStorage.removeItem("lb-theme");
      else localStorage.setItem("lb-theme", next);
    } catch {
      // Private mode or blocked storage: the toggle still works for this page view.
    }
  };
  return { choice, toggle };
}
