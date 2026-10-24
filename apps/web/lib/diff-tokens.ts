// Cheap conflict highlighting: dotted identifiers (req.session, jwt.sign) that one side adds and the other never
// mentions are probably what the two sides disagree on.

const DOTTED = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+/g;
const MAX_TOKENS = 4;

function added(preview: string): string {
  return preview
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .join("\n");
}

/** Tokens to mark on each side, in side order. */
export function conflictTokens(previews: (string | undefined)[]): string[][] {
  const texts = previews.map((p) => p ?? "");
  return texts.map((text, i) => {
    const others = texts.filter((_, j) => j !== i).join("\n");
    const mine = [...new Set(added(text || "").match(DOTTED) ?? [])];
    return mine.filter((tok) => !others.includes(tok)).slice(0, MAX_TOKENS);
  });
}

export type DiffKind = "add" | "del" | "hunk" | "ctx";

export function lineKind(line: string): DiffKind {
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+") && !line.startsWith("+++")) return "add";
  if (line.startsWith("-") && !line.startsWith("---")) return "del";
  return "ctx";
}

/** A line split into plain and marked parts. */
export function markTokens(line: string, tokens: string[]): { text: string; mark: boolean }[] {
  if (tokens.length === 0) return [{ text: line, mark: false }];
  const pattern = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return line
    .split(pattern)
    .filter(Boolean)
    .map((text) => ({ text, mark: tokens.includes(text) }));
}
