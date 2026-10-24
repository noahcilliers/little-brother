"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api, type Me } from "@/lib/api";
import { CopyCmd } from "../landing/copy-cmd";
import { errorText, Step, type StepState } from "./step";

type Props = { state: StepState; me: Me; invite: string | null; origin: string };

function Joined({ me, origin }: { me: NonNullable<Me>; origin: string }) {
  const rotate = useMutation(api.team.rotateInvite);
  const [error, setError] = useState<string | null>(null);
  const team = me.team;
  if (!team || !me.member) return null;
  return (
    <>
      <p>
        You're on <b>{team.name}</b> as <b>@{me.member.handle}</b>
        {team.isOwner ? " (owner)" : ""}. Send teammates this invite link:
      </p>
      {team.inviteCode ? (
        <CopyCmd className="plain" text={`${origin}/start?invite=${team.inviteCode}`} />
      ) : null}
      {team.isOwner ? (
        <p className="hint">
          Leaked or stale?{" "}
          <button
            type="button"
            className="link"
            onClick={() => rotate().catch((e) => setError(errorText(e)))}
          >
            Rotate the link
          </button>
          . Old links stop working; people already on the team stay.
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </>
  );
}

export function StepTeam({ state, me, invite, origin }: Props) {
  const create = useMutation(api.team.create);
  const join = useMutation(api.team.join);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => {
    setBusy(true);
    setError(null);
    p.catch((e) => setError(errorText(e))).finally(() => setBusy(false));
  };
  const body = (() => {
    if (!me) return <p className="hint">Sign in first.</p>;
    if (me.member) return <Joined me={me} origin={origin} />;
    if (!me.team)
      return (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            run(create({ name: name || `${me.user.login ?? me.user.name}'s team` }));
          }}
        >
          <p>You're the first one here, so you'll own the team and its invite link.</p>
          <input
            aria-label="Team name"
            placeholder={`${me.user.login ?? me.user.name}'s team`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn inv" disabled={busy}>
            Create team
          </button>
        </form>
      );
    if (invite)
      return (
        <div className="row">
          <p>
            You were invited to <b>{me.team.name}</b>.
          </p>
          <button type="button" className="btn inv" disabled={busy} onClick={() => run(join({ invite }))}>
            Join {me.team.name}
          </button>
        </div>
      );
    return (
      <p>
        This deployment already has a team, <b>{me.team.name}</b>. Ask its owner for the invite link.
      </p>
    );
  })();
  return (
    <Step id="team" n={2} title="Team" state={state}>
      {body}
      {error ? <p className="error">{error}</p> : null}
    </Step>
  );
}
