"use client";

import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api, type SessionHead } from "@/lib/api";
import { joinLink, watchLink } from "@/lib/share-links";
import { useAction } from "@/lib/use-action";
import { Button, IconButton } from "../ui/button";
import { FormError } from "../ui/field";
import { ShareQrCard } from "./share-qr-card";

function WatchToggle({ session }: { session: SessionHead }) {
  const setWatch = useMutation(api.sessions.setWatch);
  const { busy, error, run } = useAction();
  const on = session.watchToken !== null;
  return (
    <>
      <Button
        variant={on ? "secondary" : "primary"}
        disabled={busy}
        onClick={() => void run(() => setWatch({ sessionId: session.id, on: !on }))}
      >
        {on ? "Turn live view off" : "Turn on live view"}
      </Button>
      <FormError error={error} />
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
            <span className="muted">
              {session.room.name} · <span className="mono">{session.code}</span>
            </span>
          </div>
          <Button size="sm" onClick={() => setBig(!big)}>
            {big ? "Exit present" : "Present"}
          </Button>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        <div className="share-grid">
          <ShareQrCard
            title="Join from a phone"
            hint="Scan, sign in, and wait to be admitted."
            link={session.inviteCode ? joinLink(origin, session.inviteCode, session.id) : null}
          />
          {session.isHost ? (
            <ShareQrCard
              title="Watch live"
              hint="Read-only, no sign-in, until you turn it off."
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
