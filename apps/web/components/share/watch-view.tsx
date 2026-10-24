"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Board } from "../board/board";
import { ClassifierLog } from "../session/classifier-log";
import { PageState } from "../shell/page-state";
import { ThemeToggle } from "../shell/theme-toggle";

/** /watch/<token>: the host's shared, read-only live board, for judges' phones and projectors. */
export function WatchView({ token }: { token: string }) {
  const session = useQuery(api.watch.session, { token });
  const [tab, setTab] = useState<"board" | "log">("board");
  if (session === undefined) return <PageState title="Connecting…" />;
  if (session === null)
    return (
      <PageState title="This live view is off">
        <p>The host turned it off or shared a new link.</p>
      </PageState>
    );
  return (
    <>
      <header className="topnav">
        <span className="wordmark">
          little brother<i aria-hidden="true">▍</i>
        </span>
        <nav className="crumbs" aria-label="Session">
          <span className="crumb-sep">/</span>
          <span>{session.room}</span>
          <span className="crumb-sep">/</span>
          <span className="crumb-here">{session.name}</span>
        </nav>
        <div className="topnav-end">
          <span className="row-tag">{session.endedAt ? "ended" : "live · read-only"}</span>
          <div className="seg" role="tablist" aria-label="View">
            {(["board", "log"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? "on" : undefined}
                onClick={() => setTab(t)}
              >
                {t === "board" ? "Board" : "Classifier log"}
              </button>
            ))}
          </div>
          <ThemeToggle />
        </div>
      </header>
      {tab === "board" ? <Board watchToken={token} /> : <ClassifierLog watchToken={token} />}
    </>
  );
}
