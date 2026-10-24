import type { Board } from "./api";

/**
 * Prompt text can carry Claude Code's markup (`<pasted_content id="…">`, `<command-name>`). The backend
 * strips it, but an older row or a new tag must never reach a label, so the UI strips any `<…>` tag too.
 */
export function cleanLabel(text: string, fallback = "(pasted content)"): string {
  const out = text
    .replace(/<\/?[a-zA-Z][\w:-]*(?:\s[^<>]*)?\/?>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return out || fallback;
}

/** Every user-visible label on the board, cleaned once where the query result enters the UI. */
export function cleanBoard(board: Board): Board {
  return {
    ...board,
    tasks: board.tasks.map((k) => ({ ...k, subject: cleanLabel(k.subject) })),
    goals: board.goals.map((g) => ({ ...g, label: cleanLabel(g.label), text: cleanLabel(g.text) })),
    beats: board.beats.map((b) => ({ ...b, text: cleanLabel(b.text) })),
    sessions: board.sessions.map((s) => ({
      ...s,
      lines: s.lines.map((l) => ({ ...l, text: cleanLabel(l.text) })),
    })),
  };
}
