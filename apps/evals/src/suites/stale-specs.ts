/**
 * STALE-bench's real-derived tier ("Passes Alone, Fails Together", arXiv 2609.25396): a real Django helper,
 * an interface change to it on one branch (task A), and a consumer that reuses it on the other (task B).
 * The repo ships task B, its oracle and the anchor pair; task A is a one-line description, so the concrete
 * change below (new name, new parameter, new return type) is ours, following the paper's three mechanisms.
 */
export type Mechanism = "rename" | "signature" | "rettype";
export const MECHANISMS: readonly Mechanism[] = ["rename", "signature", "rettype"];

export type HelperSpec = {
  /** Dotted module, e.g. `django.utils.text`. */
  module: string;
  fn: string;
  renameTo: string;
  /** Result class for the return-type change. */
  resultClass: string;
  /** The module's own unit tests, as a runtests.py label. */
  label: string;
};

const TEXT = "utils_tests.test_text";
const HTML = "utils_tests.test_html";
const HTTP = "utils_tests.test_http";
const ENCODING = "utils_tests.test_encoding";

export const HELPERS: Record<string, HelperSpec> = {
  phone2numeric: {
    module: "django.utils.text",
    fn: "phone2numeric",
    renameTo: "phone_to_numeric",
    resultClass: "PhoneNumber",
    label: TEXT,
  },
  slugify: {
    module: "django.utils.text",
    fn: "slugify",
    renameTo: "make_slug",
    resultClass: "Slug",
    label: TEXT,
  },
  get_text_list: {
    module: "django.utils.text",
    fn: "get_text_list",
    renameTo: "join_text_list",
    resultClass: "TextList",
    label: TEXT,
  },
  capfirst: {
    module: "django.utils.text",
    fn: "capfirst",
    renameTo: "capitalize_first",
    resultClass: "Capitalized",
    label: TEXT,
  },
  get_valid_filename: {
    module: "django.utils.text",
    fn: "get_valid_filename",
    renameTo: "safe_filename",
    resultClass: "ValidFilename",
    label: TEXT,
  },
  normalize_newlines: {
    module: "django.utils.text",
    fn: "normalize_newlines",
    renameTo: "normalize_line_endings",
    resultClass: "NormalizedText",
    label: TEXT,
  },
  escape: {
    module: "django.utils.html",
    fn: "escape",
    renameTo: "escape_html",
    resultClass: "Escaped",
    label: HTML,
  },
  strip_tags: {
    module: "django.utils.html",
    fn: "strip_tags",
    renameTo: "remove_tags",
    resultClass: "StrippedText",
    label: HTML,
  },
  int_to_base36: {
    module: "django.utils.http",
    fn: "int_to_base36",
    renameTo: "encode_base36",
    resultClass: "Base36",
    label: HTTP,
  },
  urlencode: {
    module: "django.utils.http",
    fn: "urlencode",
    renameTo: "encode_query",
    resultClass: "QueryString",
    label: HTTP,
  },
  iri_to_uri: {
    module: "django.utils.encoding",
    fn: "iri_to_uri",
    renameTo: "encode_iri",
    resultClass: "Uri",
    label: ENCODING,
  },
  base36_to_int: {
    module: "django.utils.http",
    fn: "base36_to_int",
    renameTo: "decode_base36",
    resultClass: "Base36Value",
    label: HTTP,
  },
};

export const moduleFile = (h: HelperSpec): string => `${h.module.replaceAll(".", "/")}.py`;

const RUN = (label: string) => `Run the relevant tests with \`python tests/runtests.py ${label}\`.`;

/** Task A: a breaking, behaviour-preserving interface change to the helper, callers updated. */
export function taskA(h: HelperSpec, m: Mechanism): string {
  const where = `\`${h.fn}\` in \`${moduleFile(h)}\``;
  const change =
    m === "rename"
      ? `Rename ${where} to \`${h.renameTo}\`. This is a breaking, behaviour-preserving rename: update every caller, import and test in the repository to the new name, and don't keep the old name as an alias.`
      : m === "signature"
        ? `Give ${where} a new required keyword-only parameter \`strict\` (no default). With strict=False it behaves exactly as today; with strict=True it raises ValueError when its main argument is empty. Update every caller and test in the repository to pass strict=False explicitly.`
        : `Change ${where} to return a \`${h.resultClass}\` instead of a plain value: add a small class \`${h.resultClass}\` to the same module whose only attribute \`.value\` holds what the function returns today (no __str__ or __eq__ conveniences). Update every caller and test in the repository to read \`.value\`.`;
  return `${change} ${RUN(h.label)}`;
}

/** Task B: the benchmark's consumer task, anchored to the helper's module, which the original leaves implicit. */
export function taskB(h: HelperSpec, consumer: string): string {
  return `In \`${moduleFile(h)}\`: ${consumer} ${RUN(h.label)}`;
}

/**
 * STALE-bench's "informed" condition: what a teammate would tell the consumer up front. Hand-written per
 * mechanism, naming the new interface and that both branches will be merged.
 */
export function oracleNote(h: HelperSpec, m: Mechanism, teammate: string): string {
  const what =
    m === "rename"
      ? `renaming \`${h.fn}\` in \`${moduleFile(h)}\` to \`${h.renameTo}\`, with no alias for the old name`
      : m === "signature"
        ? `giving \`${h.fn}\` in \`${moduleFile(h)}\` a new required keyword-only parameter \`strict\` (no default); strict=False keeps today's behaviour`
        : `changing \`${h.fn}\` in \`${moduleFile(h)}\` to return a \`${h.resultClass}\` object whose \`.value\` holds today's result`;
  return `Heads-up from ${teammate}, who is working on another branch at the same time: they are ${what}. Both branches will be merged, so your code has to work once their change lands.`;
}

/** Python that holds when task A's change is in place on a tree. */
export function mechanismProbe(h: HelperSpec, m: Mechanism): string {
  if (m === "rename") return `assert hasattr(m, ${q(h.renameTo)}) and not hasattr(m, ${q(h.fn)})`;
  if (m === "signature")
    return `import inspect; p = inspect.signature(m.${h.fn}).parameters.get('strict'); assert p is not None and p.kind == p.KEYWORD_ONLY and p.default is p.empty`;
  return `assert hasattr(m, ${q(h.resultClass)})`;
}

const q = (s: string) => `'${s}'`;

/** Splits on commas outside brackets and quotes: the two arguments of an assertEqual. */
export function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] ?? "";
    if (quote) {
      if (ch === "\\") {
        cur += ch + (s[i + 1] ?? "");
        i++;
        continue;
      }
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') quote = ch;
    else if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** `self.assertEqual(a, b)` from the benchmark as a plain Python assert against module `m`. */
export function oracleAssert(oracle: string): string {
  const inner = /^self\.assertEqual\((.*)\)\s*$/s.exec(oracle.trim())?.[1];
  const args = inner ? splitArgs(inner) : [];
  if (args.length !== 2) throw new Error(`unsupported oracle: ${oracle}`);
  return `got = ${args[0]}; assert got == ${args[1]}, repr(got)`;
}

/** A standalone script: configure settings (lazy translations need them), import the module as `m`, check. */
export function pythonCheck(module: string, body: string): string {
  return [
    "import django",
    "from django.conf import settings",
    "settings.configure(USE_I18N=False)",
    "django.setup()",
    `import ${module} as m`,
    body,
  ].join("\n");
}
