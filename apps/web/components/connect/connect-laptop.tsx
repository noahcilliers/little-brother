"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { installCmd, joinCmd, oneStepCmd } from "../landing/commands";
import { CopyField } from "../shell/copy-field";
import { LiveCheck } from "../ui/badge";
import { Button } from "../ui/button";
import { FormError } from "../ui/field";

/** A one-time connect token, the one-line installer that redeems it, and a live check for the laptop. */
export function ConnectLaptop() {
  const create = useMutation(api.devices.create);
  const devices = useQuery(api.devices.list);
  const [made, setMade] = useState<{ id: string; token: string } | null>(null);
  const { busy, error, run } = useAction();
  const origin = window.location.origin;
  if (!made)
    return (
      <div className="stack-sm">
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => void run(() => create({})).then((r) => r && setMade({ id: r.id, token: r.token }))}
        >
          {busy ? "Creating…" : "Create connect token"}
        </Button>
        <FormError error={error} />
      </div>
    );
  const connected = (devices ?? []).some((d) => d.id === made.id && d.status === "active");
  return (
    <div className="stack">
      <div className="stack-sm">
        <CopyField prompt="$" text={oneStepCmd(origin, made.token)} label="Copy install command" size="lg" />
        <p className="field-hint">
          Run it in a terminal on this laptop. The token works once, within 24 hours.
        </p>
      </div>
      <details className="disclosure">
        <summary>Manual steps</summary>
        <div className="stack-sm">
          <CopyField prompt="$" text={installCmd(origin)} label="Copy installer command" />
          <CopyField prompt="$" text={joinCmd(origin, made.token)} label="Copy join command" />
        </div>
      </details>
      <LiveCheck done={connected} waiting="Waiting for this laptop…" ok="Connected" />
    </div>
  );
}
