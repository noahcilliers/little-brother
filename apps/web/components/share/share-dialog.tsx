"use client";

import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api, type SessionHead } from "@/lib/api";
import { joinLink, watchLink } from "@/lib/share-links";
import { useAction } from "@/lib/use-action";
import { ShareQrCard } from "./share-qr-card";

function WatchToggle({ session }: { session: SessionHead }) {
  const setWatch = useMutation(api.sessions.setWatch);
  const { busy, error, run } = useAction();
  const on = session.watchToken !== null;
  return (
    <>
      <button
        type="button"
        className={on ? "btn-ghost" : "btn-solid"}
        disabled={busy}
        onClick={() => void run(() => setWatch({ sessionId: session.id, on: !on }))}
      >
        {on ? "Turn live view off" : "Turn on live view"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </>
  );
}

/**
 * Show this to the room (or a projector): one QR to join from a phone through the waiting room, and, for the
 * host, one to watch the board live without signing in.
 */
export function ShareDialog({ session, onClose }: { session: SessionHead; onClose: () => void }) {
  const origin = window.location.origin;
  const [big, setBig] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="share-scrim">
      <div
        className={big ? "share present" : "share"}
        role="dialog"
        aria-modal="true"
        aria-label="Share this session"
      >
        <header className="share-head">
          <div>
            <b>{session.name}</b>
            <span className="muted small">
              {session.room.name} · code <span className="mono">{session.code}</span>
            </span>
          </div>
          <button type="button" className="btn-ghost" onClick={() => setBig(!big)}>
            {big ? "Exit present" : "Present"}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close">
            Esc
          </button>
        </header>
        <div className="share-grid">
          <ShareQrCard
            title="Join from a phone"
            hint="Scan, sign in with GitHub, and you're let in from the waiting room. The phone lands on this board."
            link={session.inviteCode ? joinLink(origin, session.inviteCode, session.id) : null}
          />
          {session.isHost ? (
            <ShareQrCard
              title="Watch live"
              hint="Read-only, no sign-in: anyone with the link sees the board and classifier log until you turn it off."
              link={session.watchToken ? watchLink(origin, session.watchToken) : null}
            >
              <WatchToggle session={session} />
            </ShareQrCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
