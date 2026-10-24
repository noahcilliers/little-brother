export const SESSION = {
  session_id: "9f1c2a",
  cwd: "/tmp/lb-demo-shop",
  transcript_path: "/nonexistent.jsonl",
};

export const userPrompt = {
  ...SESSION,
  hook_event_name: "UserPromptSubmit",
  prompt: `add CORS middleware ${"x".repeat(600)}`,
};

export const preBash = {
  ...SESSION,
  hook_event_name: "PreToolUse",
  tool_name: "Bash",
  tool_input: { command: "pnpm test --filter api" },
  tool_use_id: "toolu_01",
};

export const postBash = {
  ...SESSION,
  hook_event_name: "PostToolUse",
  tool_name: "Bash",
  tool_input: { command: "pnpm test" },
  tool_response: { stdout: Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join("\n"), stderr: "" },
  tool_use_id: "toolu_02",
};

export const postBashFailure = {
  ...SESSION,
  hook_event_name: "PostToolUseFailure",
  tool_name: "Bash",
  tool_input: { command: "curl localhost:3000/api" },
  error: "Exit code 7\ncurl: (7) Failed to connect",
  tool_use_id: "toolu_03",
};

export const stop = {
  ...SESSION,
  hook_event_name: "Stop",
  stop_hook_active: false,
  last_assistant_message: Array.from({ length: 60 }, (_, i) => `msg ${i}`).join("\n"),
};

export const transcriptLines = [
  JSON.stringify({ type: "user", message: { content: "hi" } }),
  JSON.stringify({
    type: "assistant",
    message: { id: "m1", usage: { input_tokens: 100, output_tokens: 20 } },
  }),
  JSON.stringify({
    type: "assistant",
    message: { id: "m1", usage: { input_tokens: 100, output_tokens: 20 } },
  }),
  "not json {",
  JSON.stringify({
    type: "assistant",
    message: { id: "m2", usage: { input_tokens: 5, output_tokens: "7" } },
  }),
].join("\n");
