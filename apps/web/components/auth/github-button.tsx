"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useState } from "react";
import { PREF, readPref, writePref } from "@/lib/local-pref";
import { GithubMark } from "./github-mark";

/** The one way in. Remembers that GitHub was used here so the button can say "Last used". */
export function GithubButton({ redirectTo, disabled }: { redirectTo: string; disabled?: boolean }) {
  const { signIn } = useAuthActions();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(false);
  useEffect(() => setLast(readPref(PREF.lastLogin) === "github"), []);
  return (
    <button
      type="button"
      className="oauth-btn"
      disabled={busy || disabled}
      onClick={() => {
        setBusy(true);
        writePref(PREF.lastLogin, "github");
        void signIn("github", { redirectTo }).catch(() => setBusy(false));
      }}
    >
      <GithubMark />
      <span>{busy ? "Opening GitHub…" : "Continue with GitHub"}</span>
      {last && !busy ? <span className="last-used">Last used</span> : null}
    </button>
  );
}

/** Same footprint as the real button while the auth client loads, so nothing jumps. */
export function GithubButtonPlaceholder() {
  return (
    <button type="button" className="oauth-btn" disabled>
      <GithubMark />
      <span>Continue with GitHub</span>
    </button>
  );
}
