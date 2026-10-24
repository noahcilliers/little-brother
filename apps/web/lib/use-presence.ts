"use client";

import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api, type SessionId } from "./api";

const EVERY_MS = 30_000;

/**
 * Tells the backend this member has the session open, which is what routes their agents' questions here
 * instead of to the terminal. Pings on mount, then every 30 s while the tab is visible, and on coming back.
 */
export function usePresence(sessionId: SessionId): void {
  const ping = useMutation(api.ask.ping);
  useEffect(() => {
    const send = () => void ping({ sessionId }).catch(() => undefined);
    const ifVisible = () => (document.visibilityState === "visible" ? send() : undefined);
    send();
    const id = setInterval(ifVisible, EVERY_MS);
    document.addEventListener("visibilitychange", ifVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", ifVisible);
    };
  }, [ping, sessionId]);
}
