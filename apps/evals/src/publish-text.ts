import { REPLAY_TEXT_MAX } from "@lb/core";

// Replay lines go on a public page, so every one passes through here: worktree paths become repo-relative
// and anything shaped like a credential is masked, even though eval agents shouldn't see any.

const SECRET = [
  /\bsk-[A-Za-z0-9_-]{12,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\blb_[A-Za-z0-9]{16,}/g,
  /\bBearer\s+\S+/gi,
  /\b([A-Z][A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD))=\S+/g,
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Strips the eval harness's temp worktree prefixes (and `cd <worktree>;` preambles) from a line. */
export function relativize(text: string, roots: string[]): string {
  let out = text;
  for (const root of roots.filter(Boolean).sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`cd ${escapeRe(root)}\\s*(?:;|&&)\\s*`, "g"), "");
    out = out.replace(new RegExp(`${escapeRe(root)}/?`, "g"), "");
  }
  out = out.replace(/cd (?:\/private)?\/(?:tmp|var\/folders)\/\S+\s*(?:;|&&)\s*/g, "");
  return out.replace(/(?:\/private)?\/tmp\/lb-evals\/[^/\s]+\/[^/\s]+\/[^/\s;:"'`]+\/?/g, "");
}

export function redact(text: string): string {
  return SECRET.reduce(
    (s, re) =>
      s.replace(re, (_match, name?: string) =>
        typeof name === "string" ? `${name}=[redacted]` : "[redacted]",
      ),
    text,
  );
}

/** One terminal row: first non-empty line, whitespace collapsed, clipped to the replay limit. */
export function oneLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim()) ?? "";
  const flat = line.replace(/\s+/g, " ").trim();
  return flat.length > REPLAY_TEXT_MAX ? `${flat.slice(0, REPLAY_TEXT_MAX - 1)}…` : flat;
}

export const cleanLine = (text: string, roots: string[]): string => oneLine(redact(relativize(text, roots)));
