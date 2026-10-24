/**
 * A small POSIX-shell lexer, just enough to find file redirects in a Bash tool call. Heredoc bodies are
 * read as data (never as shell), and `$(…)` / backticks are consumed but not looked into, so a commit
 * message or script body full of `>` and stray quotes cannot invent writes.
 */
export type ShellWord = { kind: "word"; text: string; literal: boolean };
export type ShellToken =
  | ShellWord
  | { kind: "op"; text: string }
  | { kind: "redirect"; op: string; fd?: number }
  | { kind: "heredoc"; body: string };

type Heredoc = Extract<ShellToken, { kind: "heredoc" }>;
type Pending = { delim: string; stripTabs: boolean; token: Heredoc };

// fd-prefixed redirects first, then control operators. Sticky so it only matches at the cursor.
const OPERATOR = /(\d*)(&>>|&>|>>|>\||>&|>|<<<|<<-|<<|<>|<&|<)|(&&|\|\||;;|;|\|&|\||&)/y;
const WORD_END = new Set([" ", "\t", "\r", "\n", ";", "&", "|", "(", ")", "<", ">"]);
const ANSI_ESCAPES: Record<string, string> = { n: "\n", t: "\t", "\\": "\\", "'": "'", '"': '"' };

class Lexer {
  private i = 0;
  private pending: Pending[] = [];

  constructor(private readonly s: string) {}

  /** Tokens up to the end, or (nested) up to the `)` that closes the current `$(`. */
  tokens(nested: boolean): ShellToken[] {
    const out: ShellToken[] = [];
    let depth = 0;
    while (this.i < this.s.length) {
      const c = this.s[this.i];
      if (c === "\n") {
        this.i++;
        out.push({ kind: "op", text: "\n" });
        this.readBodies();
      } else if (c === " " || c === "\t" || c === "\r") this.i++;
      else if (c === "\\" && this.s[this.i + 1] === "\n") this.i += 2;
      else if (c === "#") this.skipTo("\n");
      else if (c === ")" && nested && depth === 0) {
        this.i++;
        return out;
      } else if (c === "(" || c === ")") {
        depth += c === "(" ? 1 : -1;
        this.i++;
        out.push({ kind: "op", text: c });
      } else if (!this.operator(out)) out.push(this.word());
    }
    return out;
  }

  private operator(out: ShellToken[]): boolean {
    OPERATOR.lastIndex = this.i;
    const m = OPERATOR.exec(this.s);
    if (!m) return false;
    this.i = OPERATOR.lastIndex;
    const [, fd, redirect, control] = m;
    if (control) {
      out.push({ kind: "op", text: control });
      return true;
    }
    if (redirect === "<<" || redirect === "<<-") {
      while (this.s[this.i] === " " || this.s[this.i] === "\t") this.i++;
      const token: Heredoc = { kind: "heredoc", body: "" };
      this.pending.push({ delim: this.word().text, stripTabs: redirect === "<<-", token });
      out.push(token);
      return true;
    }
    out.push({ kind: "redirect", op: redirect ?? "", ...(fd ? { fd: Number(fd) } : {}) });
    return true;
  }

  private word(): ShellWord {
    let text = "";
    let literal = true;
    const start = this.i;
    while (this.i < this.s.length) {
      const c = this.s[this.i] ?? "";
      if (WORD_END.has(c)) break;
      this.i++;
      if (c === "'") text += this.until("'");
      else if (c === '"') {
        const q = this.doubleQuoted();
        text += q.text;
        literal &&= q.literal;
      } else if (c === "\\") {
        const next = this.s[this.i++] ?? "";
        if (next !== "\n") text += next;
      } else if (c === "$" || c === "`") {
        literal = false;
        text += this.expansion(c);
      } else if (c === "~" && this.i - 1 === start) {
        literal = false;
        text += c;
      } else text += c;
    }
    return { kind: "word", text, literal };
  }

  private doubleQuoted(): { text: string; literal: boolean } {
    let text = "";
    let literal = true;
    while (this.i < this.s.length) {
      const c = this.s[this.i++] ?? "";
      if (c === '"') break;
      if (c === "\\") {
        const next = this.s[this.i++] ?? "";
        text += '"\\$`'.includes(next) ? next : next === "\n" ? "" : `\\${next}`;
      } else if (c === "$" || c === "`") {
        literal = false;
        text += this.expansion(c);
      } else text += c;
    }
    return { text, literal };
  }

  /** Consumes `$name`, `${…}`, `$(…)`, `$((…))`, `$'…'` or a backtick command; returns a placeholder. */
  private expansion(c: string): string {
    if (c === "`") {
      this.skipTo("`");
      this.i++;
      return "$";
    }
    const next = this.s[this.i];
    if (next === "'") {
      this.i++;
      return this.ansiQuoted();
    }
    if (next === "(" && this.s[this.i + 1] === "(") this.skipBalanced("(", ")");
    else if (next === "(") {
      this.i++;
      this.tokens(true);
    } else if (next === "{") this.skipBalanced("{", "}");
    return "$";
  }

  private ansiQuoted(): string {
    let text = "";
    while (this.i < this.s.length) {
      const c = this.s[this.i++] ?? "";
      if (c === "'") break;
      if (c === "\\") {
        const next = this.s[this.i++] ?? "";
        text += ANSI_ESCAPES[next] ?? `\\${next}`;
      } else text += c;
    }
    return text;
  }

  private until(end: string): string {
    const j = this.s.indexOf(end, this.i);
    const stop = j < 0 ? this.s.length : j;
    const text = this.s.slice(this.i, stop);
    this.i = stop + 1;
    return text;
  }

  private skipTo(ch: string): void {
    const j = this.s.indexOf(ch, this.i);
    this.i = j < 0 ? this.s.length : j;
  }

  private skipBalanced(open: string, close: string): void {
    let depth = 0;
    while (this.i < this.s.length) {
      const c = this.s[this.i++];
      if (c === open) depth++;
      else if (c === close && --depth <= 0) return;
    }
  }

  /** Heredoc bodies start on the line after their operator, in the order the operators appeared. */
  private readBodies(): void {
    for (const p of this.pending) {
      let body = "";
      while (this.i < this.s.length) {
        const nl = this.s.indexOf("\n", this.i);
        const end = nl < 0 ? this.s.length : nl;
        const raw = this.s.slice(this.i, end);
        this.i = end + 1;
        const line = p.stripTabs ? raw.replace(/^\t+/, "") : raw;
        if (line === p.delim) break;
        body += `${line}\n`;
      }
      p.token.body = body;
    }
    this.pending = [];
  }
}

export function lexShell(command: string): ShellToken[] {
  return new Lexer(command).tokens(false);
}
