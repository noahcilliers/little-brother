"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { useEnsureAccount } from "@/lib/use-ensure-account";
import { WaitingForHost } from "../rooms/waiting-for-host";

type Props = { invite: string; sessionId: string | null; here: string };

/** Signed in: ask to join (or walk straight in), wait for the host, then open the session or room. */
function Joining({ invite, sessionId }: Omit<Props, "here">) {
  const me = useQuery(api.team.me);
  useEnsureAccount(me ?? undefined);
  const room = useQuery(api.rooms.preview, { invite });
  const status = useQuery(api.roomAdmin.myStatus, room ? { roomId: room.id } : "skip");
  const join = useMutation(api.rooms.join);
  const router = useRouter();
  const { busy, error, run } = useAction();
  const [asked, setAsked] = useState(false);
  const next = room ? (sessionId ? `/app/sessions/${sessionId}` : `/app/rooms/${room.id}`) : "/app";
  useEffect(() => {
    if (status === "member") router.replace(next);
  }, [status, next, router]);
  if (room === undefined || me === undefined) return <p className="muted">Checking the invite…</p>;
  if (room === null)
    return <p className="form-error">This invite is no longer valid. Ask the host for a new QR code.</p>;
  if (status === "member") return <p className="muted">You're in. Opening {room.name}…</p>;
  if (asked || status === "pending" || status === "denied")
    return <WaitingForHost roomId={room.id} name={room.name} next={next} />;
  return (
    <>
      <p>
        Signed in as <b>@{me?.member?.handle ?? me?.user.login ?? "you"}</b>.
      </p>
      <button
        type="button"
        className="btn-solid wide"
        disabled={busy || !me?.member}
        onClick={() => void run(() => join({ invite })).then((r) => r && setAsked(true))}
      >
        {busy ? "Asking…" : `Join ${room.name}`}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </>
  );
}

/** /r/<invite>: what a phone opens from the session's Join QR. */
export function RoomInvite({ invite, sessionId, here }: Props) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const room = useQuery(api.rooms.preview, { invite });
  const [busy, setBusy] = useState(false);
  return (
    <main className="mobile-card">
      <span className="wordmark">
        little brother<i aria-hidden="true">▍</i>
      </span>
      <h1>{room ? `Join ${room.name}` : "Join a room"}</h1>
      <p className="muted small">
        Little Brother coordinates this team's Claude Code agents. Join to watch the live board and decide
        conflicts with them.
      </p>
      {isLoading ? (
        <p className="muted">Connecting…</p>
      ) : isAuthenticated ? (
        <Joining invite={invite} sessionId={sessionId} />
      ) : (
        <button
          type="button"
          className="btn-solid wide"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void signIn("github", { redirectTo: here }).catch(() => setBusy(false));
          }}
        >
          {busy ? "Opening GitHub…" : "Sign in with GitHub"}
        </button>
      )}
    </main>
  );
}
