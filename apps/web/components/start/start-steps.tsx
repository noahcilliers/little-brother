"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Providers } from "../providers";
import type { StepState } from "./step";
import { StepConnect } from "./step-connect";
import { StepLive } from "./step-live";
import { StepSignIn } from "./step-sign-in";
import { StepTeam } from "./step-team";

const stateOf = (done: boolean, ready: boolean): StepState => (done ? "done" : ready ? "current" : "waiting");

function Steps({ origin }: { origin: string }) {
  const [invite] = useState(() => new URLSearchParams(window.location.search).get("invite"));
  const status = useQuery(api.team.status);
  const me = useQuery(api.team.me);
  const progress = useQuery(api.onboarding.progress);
  if (status === undefined || me === undefined) return <p className="start-loading">connecting…</p>;
  const signedIn = me !== null;
  const member = me?.member ?? null;
  const live = progress !== undefined && progress.sessionStart && progress.prompt && progress.edit;
  const connected = progress?.sessionStart ?? false;
  return (
    <div className="tiles start-steps">
      <StepSignIn state={stateOf(signedIn, true)} status={status} me={me} invite={invite} />
      <StepTeam state={stateOf(member !== null, signedIn)} me={me} invite={invite} origin={origin} />
      <StepConnect state={stateOf(connected, member !== null)} enabled={member !== null} origin={origin} />
      <StepLive state={stateOf(live, member !== null)} progress={member ? progress : undefined} />
    </div>
  );
}

export function StartSteps({ origin }: { origin: string }) {
  return (
    <Providers>
      <Steps origin={origin} />
    </Providers>
  );
}
