"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api, type RoomId } from "@/lib/api";
import { parseInvite } from "@/lib/invite";
import { useAction } from "@/lib/use-action";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";
import { WaitingForHost } from "./waiting-for-host";

type Props = { onJoined: (roomId: RoomId) => void; initial?: string; next?: (roomId: RoomId) => string };

/** Paste whatever a teammate sent (link or bare code); waits in place if the host has to admit you. */
export function JoinRoomForm({ onJoined, initial = "", next }: Props) {
  const join = useMutation(api.rooms.join);
  const [text, setText] = useState(initial);
  const [bad, setBad] = useState(false);
  const [waiting, setWaiting] = useState<RoomId | null>(null);
  const { busy, error, run } = useAction();
  if (waiting) return <WaitingForHost roomId={waiting} next={next?.(waiting)} />;
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const invite = parseInvite(text);
        setBad(invite === null);
        if (!invite) return;
        void run(() => join({ invite })).then((r) => {
          if (r?.status === "member") onJoined(r.roomId);
          else if (r) setWaiting(r.roomId);
        });
      }}
    >
      <Field
        label="Invite link or code"
        htmlFor="join-room"
        error={bad ? "That doesn't look like an invite link or code." : error}
      >
        <Input
          id="join-room"
          mono
          placeholder="https://…/login?invite=…"
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="primary" disabled={busy || !text.trim()}>
        {busy ? "Joining…" : "Join room"}
      </Button>
    </form>
  );
}
