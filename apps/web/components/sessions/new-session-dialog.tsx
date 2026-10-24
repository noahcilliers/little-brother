"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type RoomId } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Field, Input } from "../ui/field";

/** Name the work, get a join code, land on the session. */
export function NewSessionDialog({
  roomId,
  open,
  onClose,
}: {
  roomId: RoomId;
  open: boolean;
  onClose: () => void;
}) {
  const create = useMutation(api.sessions.create);
  const router = useRouter();
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();
  const submit = () =>
    void run(() => create({ roomId, name })).then((r) => {
      if (r) router.push(`/app/sessions/${r.sessionId}`);
    });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New session"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="new-session" disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </>
      }
    >
      <form
        id="new-session"
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Name" htmlFor="session-name" error={error}>
          <Input
            id="session-name"
            placeholder="e.g. checkout refactor"
            maxLength={80}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
      </form>
    </Dialog>
  );
}
