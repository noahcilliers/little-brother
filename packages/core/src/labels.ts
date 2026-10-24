/** The touch fields labels need; stored rows widen `op` to a string. */
type TouchLike = { path: string; symbol?: string; op: string; generated?: boolean };

/** Lower-case word shown for a verb key; a create touch turns an edit into "create". */
const VERB_WORDS: Record<string, string> = {
  EDIT: "edit",
  FIX: "fix",
  REVERT: "revert",
  TEST: "run",
  RUN: "run",
  EXPLORE: "read",
  DECIDE: "decide",
  PLAN: "plan",
  LEARN: "learn",
};
export const verbWord = (verb: string): string => VERB_WORDS[verb] ?? verb.toLowerCase();

// Which symbol best names a change: something new beats a changed signature beats a body edit.
const OP_RANK: Record<string, number> = {
  create: 0,
  signature_change: 1,
  write: 2,
  delete: 3,
  rename: 4,
  read: 5,
};

/**
 * Display form of a touch symbol (`path::name`). Touches don't record the declaration kind, so lowerCamelCase
 * compound names (issueToken, findUserByEmail) are shown as calls and single words (users, router) or
 * PascalCase types (User, Cart) as plain names. Right for the common case, and never worse than the bare name.
 */
export function symbolDisplay(symbol: string): string {
  const name = symbol.split("::").pop() ?? symbol;
  return /^[a-z_$][\w$]*[A-Z][\w$]*$/.test(name) ? `${name}()` : name;
}

/** Symbols touched, best first: by op rank, then in touch order. */
export function rankedSymbols(touches: TouchLike[]): { name: string; op: string }[] {
  return touches
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !!t.symbol && !t.generated)
    .sort((a, b) => (OP_RANK[a.t.op] ?? 9) - (OP_RANK[b.t.op] ?? 9) || a.i - b.i)
    .map(({ t }) => ({ name: symbolDisplay(t.symbol ?? ""), op: t.op }));
}

/** The one code symbol that best names a change, e.g. "issueToken()". */
export const primarySymbol = (touches: TouchLike[]): string | undefined => rankedSymbols(touches)[0]?.name;

const basename = (path: string): string => path.split("/").filter(Boolean).pop() ?? path;

function commandHead(command: string, max = 40): string {
  const flat = (command.split("\n")[0] ?? "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Short behavior label for an action node: verb + primary symbol from the touches ("edit issueToken()",
 * "create users", "run npm test"), else verb + file basename. No LLM: it must be ready on PreToolUse.
 */
export function actionLabel(a: {
  verb: string;
  tool?: string;
  touches: TouchLike[];
  files: string[];
  command?: string;
}): string {
  if (a.command) return `run ${commandHead(a.command)}`;
  const symbols = rankedSymbols(a.touches);
  const first = symbols[0];
  const fileCreate = a.touches.some((t) => !t.symbol && t.op === "create");
  const created = first ? first.op === "create" : fileCreate;
  const deleted = first?.op === "delete";
  const word =
    a.verb === "EDIT" && created ? "create" : a.verb === "EDIT" && deleted ? "delete" : verbWord(a.verb);
  if (first) {
    const names = symbols.slice(0, 2).map((s) => s.name);
    const more = symbols.length > 2 ? ` +${symbols.length - 2}` : "";
    return `${word} ${names.join(", ")}${more}`;
  }
  const file = a.files[0] ?? a.touches[0]?.path;
  if (file) return `${word} ${basename(file)}`;
  return a.tool ? `${word} ${a.tool}` : word;
}
