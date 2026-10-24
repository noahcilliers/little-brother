import { installCmd, joinCmd, MARKETPLACE_CMD, PLUGIN_CMD } from "./commands";
import { CopyCmd } from "./copy-cmd";

const SENT = [
  "Tool names and file paths",
  "Diff previews, 40 lines max",
  "Command exit codes",
  "Prompt, first 500 characters",
  "Token counts",
];
const NEVER = ["File contents", "Session transcripts", "Claude's reasoning", "Credentials and env vars"];

export function Connect({ origin }: { origin: string }) {
  return (
    <section id="connect">
      <div className="sec-head">
        <div>
          <span className="label">Connect</span>
          <h2>Three commands per teammate</h2>
        </div>
        <p>
          Machines connect out to one shared workspace. No shared login, no port forwarding, no peer-to-peer.
        </p>
      </div>
      <div className="tiles two">
        <div className="tile connect">
          <h3>Connect your Claude Code</h3>
          <ol className="steps">
            <li>
              <CopyCmd text={installCmd(origin)} />
              <small>Install the connector</small>
            </li>
            <li>
              <CopyCmd text={joinCmd(origin, "<token>")} />
              <small>
                Join your team's workspace. <a href="/login">Get started</a> gives you a token for this
                laptop.
              </small>
            </li>
            <li>
              <div className="cmd-stack">
                <CopyCmd text={MARKETPLACE_CMD} />
                <CopyCmd text={PLUGIN_CMD} />
              </div>
              <small>Add the hooks, MCP server and team protocol</small>
            </li>
          </ol>
          <p className="note">
            Hooks fail open. If Little Brother is unreachable, your agent keeps working and events sync later.
          </p>
        </div>
        <div className="tile privacy">
          <h3>What leaves your machine</h3>
          <div className="cols">
            <div>
              <span className="label">Sent</span>
              <ul>
                {SENT.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="never">
              <span className="label">Never sent</span>
              <ul>
                {NEVER.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
