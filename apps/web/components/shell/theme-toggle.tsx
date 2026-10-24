"use client";

import { type ThemeChoice, useTheme } from "@/lib/theme";
import { Icon, type IconName } from "../ui/icon";

const OPTIONS: { id: ThemeChoice; icon: IconName; label: string }[] = [
  { id: "auto", icon: "monitor", label: "System theme" },
  { id: "light", icon: "sun", label: "Light theme" },
  { id: "dark", icon: "moon", label: "Dark theme" },
];

/** System / light / dark as three small icon buttons. `compact` cycles through them with one button. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { choice, set, toggle } = useTheme();
  if (compact) {
    const now = OPTIONS.find((o) => o.id === choice) ?? OPTIONS[0];
    return (
      <button
        type="button"
        className="icon-btn"
        onClick={toggle}
        aria-label={`${now?.label}; switch`}
        title={now?.label}
      >
        <Icon name={now?.icon ?? "monitor"} />
      </button>
    );
  }
  return (
    <fieldset className="theme-toggle">
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={choice === o.id}
          aria-label={o.label}
          title={o.label}
          onClick={() => set(o.id)}
        >
          <Icon name={o.icon} size={14} />
        </button>
      ))}
    </fieldset>
  );
}
