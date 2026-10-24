"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { MARKETPLACE_CMD, oneStepCmd, PLUGIN_CMD } from "../landing/commands";
import { CopyField } from "../shell/copy-field";

/** Once per laptop: a one-time connect token, the installer that uses it, and the Claude Code plugin. */
export function LaptopSetup() {
  const create = useMutation(api.devices.create);
  const [token, setToken] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const origin = window.location.origin;
  return (
    <div className="setup">
      {token ? (
        <>
          <CopyField prompt="$" text={oneStepCmd(origin, token)} label="Copy install command" />
          <p className="muted small">
            Token shown once. Works for one laptop; expires in 24 hours if unused.
          </p>
        </>
      ) : (
        <div className="setup-token">
          <button
            type="button"
            className="btn-solid"
            disabled={busy}
            onClick={() => void run(() => create({})).then((r) => r && setToken(r.token))}
          >
            {busy ? "Creating…" : "Create connect token"}
          </button>
          <span className="muted small">Gives you a one-line installer for this laptop.</span>
        </div>
      )}
      <span className="field-label">Then add the Claude Code plugin</span>
      <CopyField prompt="$" text={MARKETPLACE_CMD} />
      <CopyField prompt="$" text={PLUGIN_CMD} />
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
