"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api, type RoomId, type SessionId } from "@/lib/api";
import { joinSlash } from "@/lib/invite";
import { useAction } from "@/lib/use-action";
import { CopyField } from "../shell/copy-field";
import { LiveCheck } from "../ui/badge";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";

type Props = { roomId: string | null; sessionId: string | null; onCreated: (id: SessionId) => void };

function Joined({ roomId, sessionId }: { roomId: string; sessionId: string }) {
  const session = useQuery(api.sessions.get, { sessionId });
  const room = useQuery(api.rooms.get, { roomId });
  const joined = (room?.sessions.find((s) => s.id === sessionId)?.claudeSessions ?? 0) > 0;
  if (!session) return <LiveCheck done={false} waiting="Loading the session…" ok="" />;
  return (
    <div className="stack">
      <CopyField prompt="›" text={joinSlash(session.code)} size="lg" label="Copy join command" />
      <LiveCheck done={joined} waiting="Waiting for Claude Code to join…" ok="Joined" />
    </div>
  );
}

/** Step 4: a first session, its join command, and a live check that Claude Code joined it. */
export function StepSession({ roomId, sessionId, onCreated }: Props) {
  const create = useMutation(api.sessions.create);
  const [name, setName] = useState("My first session");
  const { busy, error, run } = useAction();
  if (!roomId) return <p className="muted">Pick or create a room first.</p>;
  if (sessionId) return <Joined roomId={roomId} sessionId={sessionId} />;
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => create({ roomId: roomId as RoomId, name })).then((r) => r && onCreated(r.sessionId));
      }}
    >
      <Field label="Session name" htmlFor="first-session" error={error}>
        <Input id="first-session" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Creating…" : "Create session"}
      </Button>
    </form>
  );
}
