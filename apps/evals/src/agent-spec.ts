/** Which coding agent an eval runs: Claude Code (the default) or `lb agent` with a Gemini or OpenAI-compatible model. */
export type AgentSpec =
  | { kind: "claude" }
  | { kind: "lb"; provider: "gemini" | "openai"; model: string; baseUrl?: string };

/** `lb agent` plus the connector build that runs it. */
export type LbRunner = { spec: Extract<AgentSpec, { kind: "lb" }>; cliPath: string };

const DEFAULT_OPENAI_URL = "http://localhost:11434/v1";

/**
 * `claude`, `lb:gemini:<model>` or `lb:openai:<model>[@<baseUrl>]`. Model ids may contain colons
 * (`qwen2.5-coder:7b`), so the base URL is split off at the first `@`.
 */
export function parseAgentSpec(text: string): AgentSpec {
  const t = text.trim();
  if (t === "claude") return { kind: "claude" };
  const m = /^lb:(gemini|openai):(.+)$/.exec(t);
  if (!m?.[1] || !m[2])
    throw new Error(`--agent must be claude, lb:gemini:<model> or lb:openai:<model>@<url>; got ${text}`);
  const provider = m[1] === "gemini" ? "gemini" : "openai";
  const at = m[2].indexOf("@");
  const model = at >= 0 ? m[2].slice(0, at) : m[2];
  if (!model) throw new Error(`--agent ${text} names no model`);
  if (provider === "gemini") {
    if (at >= 0) throw new Error("lb:gemini takes no base URL");
    return { kind: "lb", provider, model };
  }
  return { kind: "lb", provider, model, baseUrl: at >= 0 ? m[2].slice(at + 1) : DEFAULT_OPENAI_URL };
}

export const agentLabel = (s: AgentSpec): string =>
  s.kind === "claude" ? "claude" : `lb:${s.provider}:${s.model}`;

/** Spread into `Limits`: a runner for `lb:` specs, nothing for Claude. */
export const runnerFor = (spec: AgentSpec, cliPath: string): { runner?: LbRunner } =>
  spec.kind === "lb" ? { runner: { spec, cliPath } } : {};
