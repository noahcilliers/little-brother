"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Board } from "../board/board";
import { ClassifierLogs } from "../logs/session-logs";
import { PageHeader } from "../shell/page-header";
import { PageState } from "../shell/page-state";
import { ThemeToggle } from "../shell/theme-toggle";
import { Badge, Dot } from "../ui/badge";
import { Tabs } from "../ui/tabs";

/** /watch/<token>: the host's shared, read-only live board, for judges' phones and projectors. */
export function WatchView({ token }: { token: string }) {
  const session = useQuery(api.watch.session, { token });
  const [tab, setTab] = useState<"board" | "log">("board");
  if (session === undefined) return <PageState title="Loading" loading />;
  if (session === null)
    return (
      <PageState title="This live view is off">
        <p>The host turned it off or shared a new link.</p>
      </PageState>
    );
  return (
    <div className="watch">
      <div className="watch-bar">
        <a className="wordmark" href="/">
          little brother<i aria-hidden="true">▍</i>
        </a>
        <span className="muted">{session.room}</span>
        <ThemeToggle compact />
      </div>
      <PageHeader
        title={session.name}
        meta={
          session.endedAt ? (
            <Badge>Ended</Badge>
          ) : (
            <span className="status">
              <Dot tone="ok" pulse /> Live · read-only
            </span>
          )
        }
        tabs={
          <Tabs
            label="View"
            active={tab}
            onSelect={setTab}
            tabs={[
              { id: "board", label: "Board" },
              { id: "log", label: "Classifier log" },
            ]}
          />
        }
      />
      <main className={tab === "board" ? "page page-full page-board" : "page page-full"}>
        {tab === "board" ? <Board watchToken={token} /> : <ClassifierLogs watchToken={token} />}
      </main>
    </div>
  );
}
