// Small per-browser preferences (last room, collapsed sidebar, last sign-in method). Storage can be blocked in
// private windows, so every access is guarded and a missing value is never an error.

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Blocked storage: the preference just doesn't stick.
  }
}

export const PREF = {
  lastRoom: "lb-last-room",
  sidebar: "lb-sidebar",
  lastLogin: "lb-last-login",
} as const;
