"use client";

import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { choice, toggle } = useTheme();
  return (
    <button type="button" className="btn-ghost" onClick={toggle} aria-label="Cycle theme: auto, light, dark">
      theme: {choice}
    </button>
  );
}
