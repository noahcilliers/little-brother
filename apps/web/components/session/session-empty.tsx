import Link from "next/link";
import type { SessionHead } from "@/lib/api";
import { JoinCommands } from "../connect/join-commands";
import { Icon } from "../ui/icon";

/** Until the first Claude Code session joins, the board area shows how to join it. */
export function SessionEmpty({ session }: { session: SessionHead }) {
  const ended = session.endedAt !== null;
  return (
    <div className="session-empty">
      <div className="card join-card">
        <p className="live-check">
          {ended ? null : <span className="spinner" aria-hidden="true" />}
          {ended
            ? "This session has ended. Reopen it to let Claude Code join."
            : "Waiting for Claude Code to join…"}
        </p>
        <h2>Run this in Claude Code</h2>
        <JoinCommands code={session.code} />
        <Link className="subtle-link" href={`/app/rooms/${session.room.id}/laptops`}>
          <Icon name="laptop" size={14} /> New laptop? Connect it first
        </Link>
      </div>
    </div>
  );
}
