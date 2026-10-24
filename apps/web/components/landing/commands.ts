// The real per-laptop commands, shared by the landing page and onboarding. `origin` is this site's URL.

export const installCmd = (origin: string) => `curl -fsSL ${origin}/install.sh | sh`;
export const joinCmd = (origin: string, token: string) => `lb join --url ${origin} --token ${token}`;
export const oneStepCmd = (origin: string, token: string) =>
  `curl -fsSL ${origin}/install.sh | sh -s -- join --url ${origin} --token ${token}`;
export const MARKETPLACE_CMD = "claude plugin marketplace add noahcilliers/little-brother";
export const PLUGIN_CMD = "claude plugin install little-brother@little-brother";
export const TODO_TOOLS_CMD = "export CLAUDE_CODE_ENABLE_TODO_TOOLS=1";
export const CHANNELS_CMD =
  "claude --dangerously-load-development-channels plugin:little-brother@little-brother";
