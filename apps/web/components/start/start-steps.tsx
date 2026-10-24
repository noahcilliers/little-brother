"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useEnsureAccount } from "@/lib/use-ensure-account";
import { Providers } from "../providers";
import type { StepState } from "./step";
import { StepConnect } from "./step-connect";
import { StepRooms } from "./step-rooms";
import { StepSignIn } from "./step-sign-in";

const stateOf = (done: boolean, ready: boolean): StepState => (done ? "done" : ready ? "current" : "waiting");

function Steps({ origin }: { origin: string }) {
  const [invite] = useState(() => new URLSearchParams(window.location.search).get("invite"));
  const status = useQuery(api.team.status);
  const me = useQuery(api.team.me);
  const devices = useQuery(api.devices.list);
  const rooms = useQuery(api.rooms.mine);
  const invited = useQuery(api.rooms.preview, invite ? { invite } : "skip");
  useEnsureAccount(me);
  if (status === undefined || me === undefined) return <p className="start-loading">connecting…</p>;
  const member = me?.member ?? null;
  const connected = (devices ?? []).some((d) => d.status === "active");
  const inRoom = invite ? (rooms ?? []).some((r) => r.id === invited?.id) : (rooms ?? []).length > 0;
  return (
    <div className="tiles start-steps">
      <StepSignIn state={stateOf(me !== null, true)} status={status} me={me} invite={invite} />
      <StepConnect state={stateOf(connected, member !== null)} enabled={member !== null} origin={origin} />
      <StepRooms
        state={stateOf(inRoom, member !== null)}
        enabled={member !== null}
        invite={invite}
        handle={member?.handle ?? null}
      />
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
