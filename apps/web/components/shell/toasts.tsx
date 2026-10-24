"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Button, IconButton } from "../ui/button";

export type ToastTone = "conflict" | "warn" | "info" | "ok";
export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  action?: { label: string; run: () => void };
  /** Conflicts wait for a person, so they stay until dismissed. */
  sticky?: boolean;
};

const MAX = 4;
const LIFETIME_MS = 9000;
const Ctx = createContext<(t: Toast) => void>(() => undefined);

export const useToast = () => useContext(Ctx);

function ToastCard({ t, onClose }: { t: Toast; onClose: () => void }) {
  useEffect(() => {
    if (t.sticky) return;
    const timer = setTimeout(onClose, LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [t.sticky, onClose]);
  return (
    <li className={`toast tone-${t.tone}`}>
      <div className="toast-main">
        <b>{t.title}</b>
        {t.body ? <p>{t.body}</p> : null}
      </div>
      <div className="toast-actions">
        {t.action ? (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              t.action?.run();
              onClose();
            }}
          >
            {t.action.label}
          </Button>
        ) : null}
        <IconButton icon="x" label="Dismiss" className="toast-x" onClick={onClose} />
      </div>
    </li>
  );
}

/** App-wide toasts: catches, decisions and the host's server warnings pop up here as they happen. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback(
    (t: Toast) => setToasts((all) => [t, ...all.filter((x) => x.id !== t.id)].slice(0, MAX)),
    [],
  );
  const close = useCallback((id: string) => setToasts((all) => all.filter((x) => x.id !== id)), []);
  const closers = useMemo(() => new Map(toasts.map((t) => [t.id, () => close(t.id)])), [toasts, close]);
  return (
    <Ctx.Provider value={push}>
      {children}
      <ol className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <ToastCard key={t.id} t={t} onClose={closers.get(t.id) ?? (() => close(t.id))} />
        ))}
      </ol>
    </Ctx.Provider>
  );
}
