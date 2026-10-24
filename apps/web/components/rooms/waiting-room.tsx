"use client";

import { useMutation, useQuery } from "convex/react";
import { api, type JoinRequest } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { Avatar } from "../account/avatar";
import { Button } from "../ui/button";

function RequestRow({ r }: { r: JoinRequest }) {
  const decide = useMutation(api.roomAdmin.decide);
  const { busy, error, run } = useAction();
  const where =
    r.via === "claude" ? `from Claude Code${r.session ? ` · ${r.session}` : ""}` : "via invite link";
  return (
    <li className="person">
      <Avatar src={r.avatarUrl ?? undefined} name={r.handle} size={28} />
      <span className="person-text">
        <b title={r.name}>{r.name}</b>
        <small>
          @{r.handle} · {where}
        </small>
        {error ? <small className="field-error">{error}</small> : null}
      </span>
      <span className="person-actions">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void run(() => decide({ requestId: r.id, admit: false }))}
        >
          Deny
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => void run(() => decide({ requestId: r.id, admit: true }))}
        >
          Admit
        </Button>
      </span>
    </li>
  );
}

/**
 * The host's waiting room, live. `floating` pins it to the corner like a meeting's "wants to join" prompt,
 * so it shows on the session board too; it renders nothing for non-hosts or when nobody is waiting.
 */
export function WaitingRoom({ roomId, floating = false }: { roomId: string; floating?: boolean }) {
  const requests = useQuery(api.roomAdmin.requests, { roomId });
  if (!requests || requests.length === 0) return null;
  return (
    <section className={floating ? "waiting floating" : "waiting"} aria-live="polite">
      <header className="waiting-head">
        <span className="dot dot-warn dot-pulse" aria-hidden="true" />
        <b>Waiting to join</b>
        <span className="tab-count">{requests.length}</span>
      </header>
      <ul className="people">
        {requests.map((r) => (
          <RequestRow key={r.id} r={r} />
        ))}
      </ul>
    </section>
  );
}
