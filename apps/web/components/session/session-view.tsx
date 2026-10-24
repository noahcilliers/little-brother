"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api, asSessionId } from "@/lib/api";
import { Board } from "../board/board";
import { WaitingRoom } from "../rooms/waiting-room";
import { AppHeader } from "../shell/app-header";
import { CodeChip } from "../shell/code-chip";
import { PageState } from "../shell/page-state";
import { ClassifierLog } from "./classifier-log";
import { ConnectPanel } from "./connect-panel";
import { JoinPopover } from "./join-popover";
import { ServerLog } from "./server-log";
import { SessionActions } from "./session-actions";
import { type SessionTab, ViewSwitch } from "./view-switch";

/** /app/sessions/[sessionId]: the connect steps until someone joins, then the live board. */
export function SessionView({ sessionId }: { sessionId: string }) {
  const id = asSessionId(sessionId);
  const session = useQuery(api.sessions.get, { sessionId: id });
  // Same subscription the Board opens; Convex shares it, so this costs nothing extra.
  const board = useQuery(api.dashboard.board, { sessionId: id });
  const [tab, setTab] = useState<SessionTab>("board");
  const rooms = { label: "Rooms", href: "/app" };
  if (session === undefined)
    return (
      <>
        <AppHeader crumbs={[rooms]} />
        <PageState title="Loading session…" />
      </>
    );
  if (session === null)
    return (
      <>
        <AppHeader crumbs={[rooms]} />
        <PageState title="Session not found">
          <p>It doesn't exist, or you're not in its room.</p>
        </PageState>
      </>
    );
  const empty = board !== undefined && (board === null || board.agents.length === 0);
  return (
    <>
      <AppHeader
        crumbs={[
          { label: session.room.name, href: `/app/rooms/${session.room.id}` },
          { label: session.name },
        ]}
      >
        {session.endedAt !== null ? <span className="row-tag">ended</span> : null}
        <CodeChip code={session.code} />
        {empty ? null : <ViewSwitch tab={tab} onChange={setTab} host={session.isHost} />}
        {empty ? null : <JoinPopover code={session.code} />}
        <SessionActions session={session} />
      </AppHeader>
      <WaitingRoom roomId={session.room.id} floating />
      {empty ? (
        <ConnectPanel session={session} />
      ) : tab === "log" ? (
        <ClassifierLog sessionId={id} />
      ) : tab === "server" ? (
        <ServerLog sessionId={id} />
      ) : (
        <Board sessionId={id} />
      )}
    </>
  );
}
