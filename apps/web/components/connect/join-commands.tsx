import { joinEnv, joinSlash } from "@/lib/invite";
import { CopyField } from "../shell/copy-field";

/** How a Claude Code session opts in to a session: the slash command first, the rest folded away. */
export function JoinCommands({ code }: { code: string }) {
  return (
    <div className="stack">
      <CopyField prompt="›" text={joinSlash(code)} size="lg" label="Copy join command" />
      <details className="disclosure">
        <summary>Other ways to join</summary>
        <div className="stack-sm">
          <span className="field-label">From a terminal</span>
          <CopyField prompt="$" text={joinEnv(code)} label="Copy terminal command" />
          <span className="field-label">From your phone, via Remote Control</span>
          <CopyField prompt="$" text="claude --remote-control" label="Copy Remote Control command" />
          <p className="field-hint">
            <code>/little-brother:leave</code> stops sharing.
          </p>
        </div>
      </details>
    </div>
  );
}
