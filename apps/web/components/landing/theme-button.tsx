"use client";

import { useEffect, useState } from "react";

/** Landing toggle: flips to the opposite of what's showing, and remembers it (same key as the dashboard). */
export function ThemeButton() {
  const [label, setLabel] = useState("auto");
  useEffect(() => setLabel(document.documentElement.dataset.theme ?? "auto"), []);
  const flip = () => {
    const root = document.documentElement;
    const dark = (root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    const next = dark ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("lb-theme", next);
    } catch {
      // Private mode or blocked storage: the toggle still works for this page view.
    }
    setLabel(next);
  };
  return (
    <button type="button" className="theme" aria-label="Toggle light and dark theme" onClick={flip}>
      theme: {label}
    </button>
  );
}
