export type PyParam = {
  name: string;
  kind: "positional" | "keyword" | "varargs" | "varkw";
  required: boolean;
};

/** What callers depend on: parameters, return annotation, and whether the call must be awaited. */
export type PySignature = { params: PyParam[]; returns: string; async: boolean };

const squash = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Splits at commas outside brackets; `sep` lets the caller split on other characters the same way. */
export function splitTopLevel(text: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth = Math.max(0, depth - 1);
    else if (c === sep && depth === 0) {
      out.push(text.slice(from, i));
      from = i + 1;
    }
  }
  out.push(text.slice(from));
  return out;
}

/** Index of the bracket closing the one at `open`, or -1. */
export function closingBracket(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function parseParams(text: string): PyParam[] {
  const out: PyParam[] = [];
  let keywordOnly = false;
  for (const raw of splitTopLevel(text)) {
    const piece = squash(raw);
    if (!piece || piece === "/") continue;
    if (piece === "*") {
      keywordOnly = true;
      continue;
    }
    const name = (splitTopLevel(piece, ":")[0] ?? "").split("=")[0]?.trim() ?? "";
    if (name.startsWith("**")) {
      out.push({ name: name.slice(2).trim(), kind: "varkw", required: false });
      continue;
    }
    if (name.startsWith("*")) {
      out.push({ name: name.slice(1).trim(), kind: "varargs", required: false });
      keywordOnly = true;
      continue;
    }
    const hasDefault = splitTopLevel(piece, "=").length > 1;
    out.push({ name, kind: keywordOnly ? "keyword" : "positional", required: !hasDefault });
  }
  return out;
}

/** Return annotation text after `->`, up to the colon that opens the body. */
export function parseReturns(afterParams: string): string {
  const m = /^\s*->/.exec(afterParams);
  if (!m) return "";
  const rest = afterParams.slice(m[0].length);
  return squash(splitTopLevel(rest, ":")[0] ?? "");
}

/**
 * True when existing callers can break: a parameter removed or renamed, a new required one, an optional one
 * made required, positional order or kind changed, a different return annotation, or sync/async flipped.
 * New optional parameters and changed defaults are compatible. Annotations on parameters are not compared:
 * Python does not enforce them at call sites.
 */
export function signatureBreaks(before: PySignature, after: PySignature): boolean {
  if (before.returns !== after.returns || before.async !== after.async) return true;
  const byName = new Map(after.params.map((p) => [p.name, p]));
  for (const p of before.params) {
    const now =
      p.kind === "varargs" || p.kind === "varkw"
        ? after.params.find((q) => q.kind === p.kind)
        : byName.get(p.name);
    if (!now || now.kind !== p.kind || (now.required && !p.required)) return true;
  }
  const old = new Set(before.params.map((p) => p.name));
  if (after.params.some((p) => !old.has(p.name) && p.required)) return true;
  const positional = (ps: PyParam[]) =>
    ps.filter((p) => p.kind === "positional" && old.has(p.name) && byName.has(p.name)).map((p) => p.name);
  return positional(before.params).join(",") !== positional(after.params).join(",");
}
