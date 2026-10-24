import { CHANNELS_CMD, MARKETPLACE_CMD, PLUGIN_CMD, TODO_TOOLS_CMD } from "../landing/commands";
import { CopyField } from "../shell/copy-field";

/** The Claude Code plugin, plus the optional launch flags folded away. */
export function PluginSteps() {
  return (
    <div className="stack">
      <div className="stack-sm">
        <CopyField prompt="$" text={MARKETPLACE_CMD} label="Copy marketplace command" />
        <CopyField prompt="$" text={PLUGIN_CMD} label="Copy plugin install command" />
      </div>
      <details className="disclosure">
        <summary>Optional launch flags</summary>
        <div className="stack-sm">
          <CopyField prompt="$" text={TODO_TOOLS_CMD} label="Copy task-list flag" />
          <p className="field-hint">Shows each agent's plan on the board.</p>
          <CopyField prompt="$" text={CHANNELS_CMD} label="Copy channels command" />
          <p className="field-hint">Lets urgent notices reach a running session (research preview).</p>
        </div>
      </details>
    </div>
  );
}
