"use client";

import { useMutation, useQuery } from "convex/react";
import { api, type JoinRequest } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { Avatar } from "../account/avatar";

function RequestRow({ r }: { r: JoinRequest }) {
  const decide = useMutation(api.roomAdmin.decide);
  const { busy, error, run } = useAction();
  const where =
    r.via === "claude" ? `from Claude Code${r.session ? ` · ${r.session}` : ""}` : "via invite link";
  return (
    <li className="wait-row">
      <Avatar src={r.avatarUrl ?? undefined} name={r.handle} size={24} />
      <span className="row-main">
        <b title={r.name}>{r.name}</b>
        <small>
          @{r.handle} · {where}
        </small>
      </span>
      <button
        type="button"
        className="btn-ghost"
        disabled={busy}
        onClick={() => void run(() => decide({ requestId: r.id, admit: false }))}
      >
        Deny
      </button>
      <button
        type="button"
        className="btn-solid"
        disabled={busy}
        onClick={() => void run(() => decide({ requestId: r.id, admit: true }))}
      >
        Admit
      </button>
      {error ? <p className="form-error">{error}</p> : null}
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
    <section className={floating ? "panel waiting floating" : "panel waiting"} aria-live="polite">
      <div className="panel-h">
        Waiting to join <span className="count-pill on">{requests.length}</span>
      </div>
      <ul className="people">
        {requests.map((r) => (
          <RequestRow key={r.id} r={r} />
        ))}
      </ul>
    </section>
  );
}
