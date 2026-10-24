import type { Op } from "../ingest";
import type { ClassifiedNode } from "./types";

// Unified diff → touches, for turning third-party datasets (PR diffs) into pairs the classifier can read.
// Language-agnostic and regex-only on purpose: hunk ranges, def/class/function names from hunk headers and
// changed lines, and a signature change when a definition's parameter list differs between - and +.

type Touch = ClassifiedNode["touches"][number];
export type DiffFile = {
  path: string;
  oldPath?: string;
  status: "added" | "removed" | "modified" | "renamed";
  patch: string;
};

const DEFS: RegExp[] = [
  /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)/,
  /^\s*class\s+([A-Za-z_]\w*)()/,
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)/,
  /^\s*(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::[^=]*)?=>/,
  /^\s*(?:export\s+)?(?:abstract\s+)?(?:class|interface|type|enum)\s+([A-Za-z_$][\w$]*)()/,
  /^func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(([^)]*)/,
];
const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;
const GENERATED = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock|go\.sum)$|(^|\/)(dist|build|vendor|node_modules)\/|\.min\.(js|css)$/;
const NOT_REFS = new Set(
  "self this super print len range str int float bool dict list tuple set isinstance hasattr getattr setattr super return await async lambda assert require import export from function const typeof instanceof append extend format items keys values join split strip replace startswith endswith console log error warn push slice filter map reduce forEach then catch resolve reject Promise Object Array String Number Boolean JSON Math Error Date".split(
    " ",
  ),
);

function definition(line: string): { name: string; params: string } | null {
  for (const re of DEFS) {
    const m = re.exec(line);
    if (m?.[1]) return { name: m[1], params: (m[2] ?? "").replace(/\s+/g, "") };
  }
  return null;
}

/** Split `git diff` text into per-file patches (the GitHub compare API already returns them split). */
export function parseUnifiedDiff(text: string): DiffFile[] {
  const out: DiffFile[] = [];
  for (const chunk of text.split(/^diff --git /m).slice(1)) {
    const header = /^a\/(\S+) b\/(\S+)/.exec(chunk);
    if (!header?.[2]) continue;
    const body = chunk.slice(chunk.indexOf("\n") + 1);
    const at = body.search(/^@@ /m);
    const meta = at >= 0 ? body.slice(0, at) : body;
    const status: DiffFile["status"] = /^new file mode/m.test(meta)
      ? "added"
      : /^deleted file mode/m.test(meta)
        ? "removed"
        : /^rename from/m.test(meta)
          ? "renamed"
          : "modified";
    out.push({
      path: header[2],
      ...(header[1] !== header[2] ? { oldPath: header[1] } : {}),
      status,
      patch: at >= 0 ? body.slice(at) : "",
    });
  }
  return out;
}

const FILE_OP: Record<DiffFile["status"], Op> = { added: "create", removed: "delete", renamed: "rename", modified: "write" };

function fileTouches(f: DiffFile, refs: Set<string>, defined: Set<string>): Touch[] {
  const fileOp = FILE_OP[f.status];
  const generated = GENERATED.test(f.path);
  const out: Touch[] = [];
  const hunks = f.patch.split(/^(?=@@ )/m).filter((h) => h.startsWith("@@"));
  if (hunks.length === 0) out.push({ path: f.path, op: fileOp, ...(generated ? { generated } : {}) });
  for (const h of hunks) {
    const [head = "", ...lines] = h.split("\n");
    const m = HUNK.exec(head);
    if (!m) continue;
    const oldStart = Number(m[1]);
    const oldLen = m[2] === undefined ? 1 : Number(m[2]);
    const newLen = m[4] === undefined ? 1 : Number(m[4]);
    // Base-side coordinates: both sides of a pair share the merge base, so their ranges are comparable.
    const range: [number, number] = oldStart === 0 ? [1, Math.max(1, newLen)] : [oldStart, oldStart + Math.max(oldLen, 1) - 1];
    out.push({ path: f.path, op: fileOp, lines: range, ...(generated ? { generated } : {}) });
    const removed = new Map<string, string>();
    const added = new Map<string, string>();
    for (const line of lines) {
      if (!/^[+-]/.test(line)) continue;
      const def = definition(line.slice(1));
      if (def) (line[0] === "+" ? added : removed).set(def.name, def.params);
      if (line[0] !== "+") continue;
      for (const c of line.matchAll(/\b([A-Za-z_][\w]{3,})\s*\(/g)) if (c[1]) refs.add(c[1]);
      const imp = /^\+\s*(?:from\s+\S+\s+)?import\s+(?:\{([^}]*)\}|(.+?))(?:\s+from\b|$)/.exec(line);
      for (const name of (imp?.[1] ?? imp?.[2] ?? "").split(/[,\s]+/)) if (/^[A-Za-z_]\w{3,}$/.test(name)) refs.add(name);
    }
    const symbol = (name: string, op: Op): Touch => ({ path: f.path, symbol: `${f.path}::${name}`, op, lines: range });
    for (const [name, params] of added) {
      defined.add(name);
      const before = removed.get(name);
      out.push(symbol(name, before === undefined ? "create" : before === params ? "write" : "signature_change"));
    }
    for (const name of removed.keys()) if (!added.has(name)) out.push(symbol(name, "delete"));
    const enclosing = definition(m[5] ?? "")?.name;
    if (enclosing && !added.has(enclosing) && !removed.has(enclosing)) out.push(symbol(enclosing, fileOp));
  }
  return out;
}

/** Touches and references for one side's diff, ready to put on a ClassifiedNode. */
export function diffTouches(files: DiffFile[], maxRefs = 40): { touches: Touch[]; references: string[] } {
  const refs = new Set<string>();
  const defined = new Set<string>();
  const touches = files.flatMap((f) => fileTouches(f, refs, defined));
  const references = [...refs].filter((r) => !NOT_REFS.has(r) && !defined.has(r)).slice(0, maxRefs);
  return { touches, references };
}
