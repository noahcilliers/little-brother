"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api, type SessionHead } from "@/lib/api";
import { JoinCommands } from "./join-commands";
import { LaptopSetup } from "./laptop-setup";

/** Shown until the first Claude Code session joins; the board replaces it live when one does. */
export function ConnectPanel({ session }: { session: SessionHead }) {
  const devices = useQuery(api.devices.list);
  const [another, setAnother] = useState(false);
  const connected = (devices ?? []).filter((d) => d.status === "active");
  const ended = session.endedAt !== null;
  return (
    <main className="page page-narrow">
      <div className="page-head">
        <h1 title={session.name}>{session.name}</h1>
        <p className="waiting">
          <span className={ended ? "live-dot" : "live-dot on"} aria-hidden="true" />
          {ended
            ? "This session has ended. Reopen it to let Claude Code sessions join."
            : "Waiting for the first Claude Code session to join…"}
        </p>
      </div>
      <ol className="connect-steps">
        <li className="panel">
          <div className="panel-h">
            <span className="step-num">01</span> Connect this laptop
            {connected.length > 0 ? <span className="row-tag on">done</span> : null}
          </div>
          <div className="panel-body">
            {connected.length > 0 && !another ? (
              <p className="muted small">
                Connected: {connected.map((d) => d.machine ?? d.label).join(", ")}.{" "}
                <button type="button" className="link-btn" onClick={() => setAnother(true)}>
                  Connect another laptop
                </button>
              </p>
            ) : (
              <LaptopSetup />
            )}
          </div>
        </li>
        <li className="panel">
          <div className="panel-h">
            <span className="step-num">02</span> Join this session
          </div>
          <div className="panel-body">
            <JoinCommands code={session.code} />
          </div>
        </li>
      </ol>
    </main>
  );
}
