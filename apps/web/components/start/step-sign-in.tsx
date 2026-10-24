"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import type { Me, TeamStatus } from "@/lib/api";
import { convexSiteUrl } from "@/lib/convex-urls";
import { Avatar } from "../account/avatar";
import { Step, type StepState } from "./step";

type Props = { state: StepState; status: TeamStatus; me: Me; invite: string | null };

function NotConfigured({ status }: { status: TeamStatus }) {
  return (
    <div className="notice">
      <b>Sign-in not configured yet</b>
      <p>
        This deployment is missing {status.missing.join(", ")}. Create a GitHub OAuth app with the callback URL
        below, set the variables on the Convex deployment (<code>npx convex env set NAME value</code>), and
        generate the JWT keys with <code>npx @convex-dev/auth</code>. DEPLOY.md has the steps.
      </p>
      <code className="block">{convexSiteUrl()}/api/auth/callback/github</code>
      {status.openMode ? (
        <p>
          Local open mode is on, so the dashboard works without sign-in: <a href="/app">open it</a>.
        </p>
      ) : null}
    </div>
  );
}

export function StepSignIn({ state, status, me, invite }: Props) {
  const { signIn, signOut } = useAuthActions();
  const [busy, setBusy] = useState(false);
  const redirectTo = invite ? `/start?invite=${encodeURIComponent(invite)}` : "/start";
  return (
    <Step id="sign-in" n={1} title="Sign in with GitHub" state={state}>
      {me ? (
        <div className="who">
          <Avatar src={me.user.image} name={me.user.login ?? me.user.name} size={32} />
          <div>
            <b>{me.user.name}</b>
            <span>@{me.user.login ?? me.member?.handle ?? "you"} · your GitHub login becomes your handle</span>
          </div>
          <button type="button" className="link" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      ) : status.signInReady ? (
        <>
          <p>Your GitHub login becomes your handle on the dashboard. Nothing else is requested.</p>
          <button
            type="button"
            className="btn inv"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void signIn("github", { redirectTo }).catch(() => setBusy(false));
            }}
          >
            {busy ? "Opening GitHub…" : "Sign in with GitHub"}
          </button>
        </>
      ) : (
        <NotConfigured status={status} />
      )}
    </Step>
  );
}
