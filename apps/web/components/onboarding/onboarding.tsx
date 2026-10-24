"use client";

import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { useEnsureAccount } from "@/lib/use-ensure-account";
import { Avatar } from "../account/avatar";
import { PluginSteps } from "../connect/plugin-steps";
import { PageState } from "../shell/page-state";
import { Progress } from "./progress";
import { StepConnect } from "./step-connect";
import { StepSession } from "./step-session";
import { StepWorkspace } from "./step-workspace";
import { type Carry, isStep, neighbour, type StepId, stepHref } from "./steps";
import { WizardCard } from "./wizard-card";

type Screen = {
  title: string;
  description: string;
  body: ReactNode;
  next: { href: string; label: string } | null;
};

/** /onboarding: one step per screen; the URL holds the step and what earlier steps chose. */
export function Onboarding() {
  const params = useSearchParams();
  const router = useRouter();
  const me = useQuery(api.team.me);
  const rooms = useQuery(api.rooms.mine);
  useEnsureAccount(me);
  const asked = params.get("step");
  const step: StepId = isStep(asked) ? asked : "workspace";
  const carry: Carry = {
    room: params.get("room"),
    session: params.get("session"),
    invite: params.get("invite"),
  };
  if (me === undefined || rooms === undefined) return <PageState title="Loading" loading />;
  const room = carry.room ?? rooms[0]?.id ?? null;
  const go = (s: StepId, c: Carry) => router.push(stepHref(s, c));
  const after = neighbour(step, 1);
  const before = neighbour(step, -1);
  const done = carry.session ? `/app/sessions/${carry.session}` : room ? `/app/rooms/${room}` : "/app";
  const onward = after ? stepHref(after, carry) : done;
  const handle = me?.member?.handle ?? null;
  const screens: Record<StepId, Screen> = {
    workspace: {
      title: "Set up your workspace",
      description: "A room is your team. Each session in it gets one live board.",
      body: (
        <StepWorkspace carry={carry} handle={handle} onRoom={(id) => go("connect", { ...carry, room: id })} />
      ),
      next: carry.room ? { href: onward, label: "Continue" } : null,
    },
    connect: {
      title: "Connect this laptop",
      description: "Installs the lb connector and links it to your account.",
      body: <StepConnect />,
      next: { href: onward, label: "Continue" },
    },
    plugin: {
      title: "Add the Claude Code plugin",
      description: "Run these once in a terminal.",
      body: <PluginSteps />,
      next: { href: onward, label: "Continue" },
    },
    session: {
      title: "Start a session",
      description: "Run the join command in Claude Code to share that work.",
      body: (
        <StepSession
          roomId={room}
          sessionId={carry.session}
          onCreated={(id) => go("session", { ...carry, room, session: id })}
        />
      ),
      next: { href: done, label: "Open dashboard" },
    },
  };
  const s = screens[step];
  return (
    <div className="onboarding">
      <header className="onb-top">
        <a className="wordmark" href="/">
          little brother<i aria-hidden="true">▍</i>
        </a>
        <Progress step={step} />
        <span className="onb-who">
          {me ? <Avatar src={me.user.image} name={handle ?? me.user.name} size={24} /> : null}
        </span>
      </header>
      <main className="onb-main">
        <WizardCard
          key={step}
          title={s.title}
          description={s.description}
          back={before ? stepHref(before, carry) : null}
          skip={after ? onward : null}
          next={s.next}
        >
          {s.body}
        </WizardCard>
      </main>
    </div>
  );
}
