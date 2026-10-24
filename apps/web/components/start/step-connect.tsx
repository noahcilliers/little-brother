"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  CHANNELS_CMD,
  installCmd,
  joinCmd,
  MARKETPLACE_CMD,
  oneStepCmd,
  PLUGIN_CMD,
  TODO_TOOLS_CMD,
} from "../landing/commands";
import { CopyCmd } from "../landing/copy-cmd";
import { Devices } from "./devices";
import { errorText, Step, type StepState } from "./step";

type Props = { state: StepState; enabled: boolean; origin: string };

export function StepConnect({ state, enabled, origin }: Props) {
  const create = useMutation(api.devices.create);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = token ?? "<token>";
  const makeToken = () => {
    setBusy(true);
    setError(null);
    create({})
      .then((r) => setToken(r.token))
      .catch((e) => setError(errorText(e)))
      .finally(() => setBusy(false));
  };
  return (
    <Step id="connect" n={3} title="Connect this laptop" state={state}>
      {!enabled ? <p className="hint">Join the team first.</p> : null}
      <div className={enabled ? "cmds" : "cmds off"}>
        <div className="cmd-group">
          <span className="label">a · connect token for this laptop</span>
          {token ? (
            <p className="hint">Shown once. Works for one laptop and expires in 24 hours if unused.</p>
          ) : (
            <button type="button" className="btn inv" disabled={!enabled || busy} onClick={makeToken}>
              {busy ? "Creating…" : "Create connect token"}
            </button>
          )}
        </div>
        <div className="cmd-group">
          <span className="label">b · install the connector and join</span>
          <CopyCmd text={oneStepCmd(origin, t)} />
          <p className="hint">Or in two steps:</p>
          <CopyCmd text={installCmd(origin)} />
          <CopyCmd text={joinCmd(origin, t)} />
        </div>
        <div className="cmd-group">
          <span className="label">c · add the Claude Code plugin</span>
          <CopyCmd text={MARKETPLACE_CMD} />
          <CopyCmd text={PLUGIN_CMD} />
        </div>
        <div className="cmd-group">
          <span className="label">d · start Claude Code</span>
          <CopyCmd text={TODO_TOOLS_CMD} />
          <CopyCmd text={CHANNELS_CMD} />
          <p className="hint">
            <code>CLAUDE_CODE_ENABLE_TODO_TOOLS=1</code> turns on the task-list tools, so the dashboard can
            show each agent's plan. The channels flag lets Little Brother push urgent notices into a running
            session (research preview); without it, notices still arrive through hook responses.
          </p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {enabled ? <Devices /> : null}
    </Step>
  );
}
