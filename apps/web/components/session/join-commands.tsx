import { joinEnv, joinSlash } from "@/lib/invite";
import { CopyField } from "../shell/copy-field";

/** The two ways a Claude Code session opts in to this session. */
export function JoinCommands({ code }: { code: string }) {
  return (
    <div className="setup">
      <span className="field-label">In Claude Code, run</span>
      <CopyField prompt="›" text={joinSlash(code)} className="strong" label="Copy join command" />
      <span className="field-label">or start Claude Code from a terminal</span>
      <CopyField prompt="$" text={joinEnv(code)} label="Copy terminal command" />
      <p className="muted small">
        <code>/little-brother:leave</code> stops sharing. Only sessions that join are tracked.
      </p>
    </div>
  );
}
