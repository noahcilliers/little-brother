"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api, type SessionHead } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { JoinCommands } from "../connect/join-commands";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { FormError } from "../ui/field";
import { Icon } from "../ui/icon";
import { Menu, MenuItem, MenuSeparator } from "../ui/menu";

/** The session's overflow: how to join, and ending or reopening it. */
export function SessionMenu({ session }: { session: SessionHead }) {
  const end = useMutation(api.sessions.end);
  const reopen = useMutation(api.sessions.reopen);
  const { busy, error, run } = useAction();
  const [dialog, setDialog] = useState<"join" | "end" | null>(null);
  const ended = session.endedAt !== null;
  return (
    <>
      <Menu label="More actions" triggerClass="icon-btn bordered" align="end" trigger={<Icon name="more" />}>
        <MenuItem icon="terminal" onSelect={() => setDialog("join")}>
          How to join
        </MenuItem>
        <MenuItem icon="laptop" href={`/app/rooms/${session.room.id}/laptops`}>
          Connect a laptop
        </MenuItem>
        <MenuSeparator />
        {ended ? (
          <MenuItem icon="undo" onSelect={() => void run(() => reopen({ sessionId: session.id }))}>
            Reopen session
          </MenuItem>
        ) : (
          <MenuItem icon="stop" danger onSelect={() => setDialog("end")}>
            End session
          </MenuItem>
        )}
      </Menu>
      <Dialog open={dialog === "join"} onClose={() => setDialog(null)} title="Join from Claude Code">
        <JoinCommands code={session.code} />
      </Dialog>
      <Dialog
        open={dialog === "end"}
        onClose={() => setDialog(null)}
        title="End this session?"
        size="sm"
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                setDialog(null);
                void run(() => end({ sessionId: session.id }));
              }}
            >
              End session
            </Button>
          </>
        }
      >
        <p className="muted">Recording stops. You can reopen it later.</p>
      </Dialog>
      <FormError error={error} />
    </>
  );
}
