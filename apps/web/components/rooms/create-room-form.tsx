"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api, type RoomId } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";

type Props = { onCreated: (roomId: RoomId) => void; placeholder?: string; submit?: string };

/** Name a room and create it; the caller decides where to go next. */
export function CreateRoomForm({
  onCreated,
  placeholder = "e.g. payments-team",
  submit = "Create room",
}: Props) {
  const create = useMutation(api.rooms.create);
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => create({ name })).then((r) => r && onCreated(r.roomId));
      }}
    >
      <Field label="Room name" htmlFor="room-name" error={error}>
        <Input
          id="room-name"
          placeholder={placeholder}
          maxLength={60}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Creating…" : submit}
      </Button>
    </form>
  );
}
