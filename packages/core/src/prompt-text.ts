// What Claude Code puts in a prompt besides the developer's words: harness blocks that are not intent,
// and wrappers around pasted text whose content is. Session join/leave lines are commands to us.

const DROP_BLOCKS = [
  "system-reminder",
  "task-notification",
  "local-command-stdout",
  "local-command-stderr",
  "command-message",
  "command-args",
];
const UNWRAP_TAGS = ["pasted_content", "command-name", "ide_selection", "ide_opened_file"];

const dropBlock = (s: string, tag: string) =>
  s.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "g"), " ");
const unwrap = (s: string, tag: string) => s.replace(new RegExp(`</?${tag}\\b[^>]*>`, "g"), " ");

/** The developer's own words: harness blocks removed, paste wrappers unwrapped, whitespace and markdown emphasis flattened. */
export function cleanPrompt(raw: string): string {
  let s = raw;
  for (const tag of DROP_BLOCKS) s = dropBlock(s, tag);
  for (const tag of UNWRAP_TAGS) s = unwrap(s, tag);
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export type SessionCommand = { kind: "join"; code: string } | { kind: "leave" };

const JOIN = /(?:^|\s)(?:\/little-brother:join|lb:join)\s+([A-Za-z0-9-]{4,40})\b/;
const LEAVE = /(?:^|\s)(?:\/little-brother:leave|lb:leave)\b/;

/** `/little-brother:join <code>` as typed, or the `lb:join <code>` marker the plugin command expands to. */
export function sessionCommand(prompt: string): SessionCommand | null {
  const join = JOIN.exec(prompt);
  if (join?.[1]) return { kind: "join", code: join[1].toLowerCase() };
  return LEAVE.test(prompt) ? { kind: "leave" } : null;
}
