"use client";

import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, asSessionId } from "@/lib/api";
import { Board } from "../board/board";
import { ClassifierLogs, ServerLogs } from "../logs/session-logs";
import { WaitingRoom } from "../rooms/waiting-room";
import { ShareButton } from "../share/share-button";
import { CodeChip } from "../shell/code-chip";
import { PageHeader } from "../shell/page-header";
import { PageState } from "../shell/page-state";
import { ButtonLink } from "../ui/button";
import { type Tab, Tabs } from "../ui/tabs";
import { ServerAlerts } from "./server-alerts";
import { SessionEmpty } from "./session-empty";
import { SessionMenu } from "./session-menu";
import { SessionStatus } from "./session-status";

type SessionTab = "board" | "classifier" | "server";
const TABS: Tab<SessionTab>[] = [
  { id: "board", label: "Board" },
  { id: "classifier", label: "Classifier log" },
  { id: "server", label: "Server log" },
];
const isTab = (t: string | null): t is SessionTab => t === "board" || t === "classifier" || t === "server";

/** /app/sessions/[sessionId]: the live board, with the classifier and (host) server logs as tabs. */
export function SessionView({ sessionId }: { sessionId: string }) {
  const id = asSessionId(sessionId);
  const session = useQuery(api.sessions.get, { sessionId: id });
  // Same subscription the Board opens; Convex shares it, so this costs nothing extra.
  const board = useQuery(api.dashboard.board, { sessionId: id });
  const params = useSearchParams();
  const router = useRouter();
  const asked = params.get("tab");
  if (session === undefined) return <PageState title="Loading" loading />;
  if (session === null)
    return (
      <PageState title="Session not found">
        <p>It doesn't exist, or you're not in its room.</p>
        <ButtonLink href="/app">Back to your rooms</ButtonLink>
      </PageState>
    );
  const tabs = TABS.filter((t) => session.isHost || t.id !== "server");
  const tab: SessionTab = isTab(asked) && tabs.some((t) => t.id === asked) ? asked : "board";
  const empty = board !== undefined && (board === null || board.agents.length === 0);
  const href = (t: SessionTab) => (t === "board" ? `/app/sessions/${id}` : `/app/sessions/${id}?tab=${t}`);
  return (
    <>
      <PageHeader
        title={session.name}
        meta={
          <>
            <SessionStatus session={session} />
            <CodeChip code={session.code} />
          </>
        }
        actions={
          <>
            <ShareButton session={session} />
            <SessionMenu session={session} />
          </>
        }
        tabs={<Tabs tabs={tabs} active={tab} label="Session views" href={href} />}
      />
      <WaitingRoom roomId={session.room.id} floating />
      {session.isHost ? (
        <ServerAlerts sessionId={id} onOpenLog={() => router.replace(href("server"))} />
      ) : null}
      <main className={tab === "board" ? "page page-full page-board" : "page page-full"}>
        {tab === "classifier" ? (
          <ClassifierLogs sessionId={id} />
        ) : tab === "server" ? (
          <ServerLogs sessionId={id} />
        ) : empty ? (
          <SessionEmpty session={session} />
        ) : (
          <Board sessionId={id} />
        )}
      </main>
    </>
  );
}
