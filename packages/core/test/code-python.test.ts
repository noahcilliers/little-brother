import { describe, expect, it } from "vitest";
import { parsePython } from "../src/code/py-defs";
import { diffPython } from "../src/code/py-diff";
import { pythonImports } from "../src/code/py-imports";
import { logicalLines, maskPython } from "../src/code/py-lex";
import { pyResolver, type RepoFs } from "../src/code/py-resolve";
import { parseParams, signatureBreaks } from "../src/code/py-signature";

function memFs(files: Record<string, string>): RepoFs {
  return { exists: (rel) => rel in files, read: (rel) => files[rel] ?? null };
}

const SRC = `"""Module doc with def fake(): and a ( bracket."""
import os
from typing import (
    Any,
    Optional,
)

# def commented_out(x):


@decorator
@other.decorator(arg=1)
def top(a, b: int = 2, *args, key: str, **kw) -> Optional[str]:
    s = "def inner_string(): ("
    return s


async def fetch(
    url: str,
    timeout: float = 1.0,
) -> bytes:
    def helper():
        return 1
    return b""


class Outer(Base):
    x = 1

    def method(self, y):
        return y

    class Inner:
        @property
        def value(self) -> int:
            return 1

    def after(self): return 2
`;

describe("python lexer and defs", () => {
  it("masks strings and comments without moving offsets", () => {
    const masked = maskPython(SRC);
    expect(masked.length).toBe(SRC.length);
    expect(masked).not.toContain("inner_string");
    expect(masked).not.toContain("commented_out");
  });

  it("joins bracketed continuation lines", () => {
    const lines = logicalLines(maskPython(SRC));
    const fetch = lines.find((l) => l.text.startsWith("async def fetch"));
    expect(fetch?.text).toContain("-> bytes:");
  });

  it("finds defs, classes, methods and nested classes with decorators in the span", () => {
    const { defs } = parsePython(SRC);
    expect(defs.map((d) => d.qualname)).toEqual([
      "top",
      "fetch",
      "Outer",
      "Outer.method",
      "Outer.Inner",
      "Outer.Inner.value",
      "Outer.after",
    ]);
    const top = defs.find((d) => d.qualname === "top");
    expect(SRC.slice(top?.span.start, top?.span.end)).toMatch(/^@decorator[\s\S]*return s$/);
    expect(top?.signature?.params.map((p) => `${p.kind}:${p.name}:${p.required}`)).toEqual([
      "positional:a:true",
      "positional:b:false",
      "varargs:args:false",
      "keyword:key:true",
      "varkw:kw:false",
    ]);
    expect(top?.signature?.returns).toBe("Optional[str]");
    const fetch = defs.find((d) => d.qualname === "fetch");
    expect(fetch?.signature).toMatchObject({ async: true, returns: "bytes" });
    const outer = defs.find((d) => d.qualname === "Outer");
    expect(SRC.slice(outer?.span.start, outer?.span.end).trimEnd().endsWith("return 2")).toBe(true);
  });
});

describe("signature compatibility", () => {
  const sig = (params: string, returns = "") => ({ params: parseParams(params), returns, async: false });
  it("flags breaking changes", () => {
    expect(signatureBreaks(sig("a, b"), sig("a, b, c"))).toBe(true); // new required
    expect(signatureBreaks(sig("a, b"), sig("a"))).toBe(true); // removed
    expect(signatureBreaks(sig("a, b"), sig("a, c"))).toBe(true); // renamed
    expect(signatureBreaks(sig("a, b=1"), sig("a, b"))).toBe(true); // became required
    expect(signatureBreaks(sig("a, b"), sig("b, a"))).toBe(true); // reordered
    expect(signatureBreaks(sig("a, b"), sig("a, *, b"))).toBe(true); // keyword-only now
    expect(signatureBreaks(sig("a", "int"), sig("a", "str"))).toBe(true);
  });
  it("accepts compatible changes", () => {
    expect(signatureBreaks(sig("a"), sig("a, b=None"))).toBe(false);
    expect(signatureBreaks(sig("a: int"), sig("a: str"))).toBe(false);
    expect(signatureBreaks(sig("a, b=1"), sig("a, b=2"))).toBe(false);
  });
});

describe("python imports and resolution", () => {
  const fs = memFs({
    "src/pkg/__init__.py": "from .core import Command\n",
    "src/pkg/core.py": "class Command:\n    pass\n",
    "src/pkg/utils.py": "def slug(x):\n    return x\n",
    "helpers.py": "def format_name(n):\n    return n\n",
  });
  it("parses every import form", () => {
    const text =
      "import a.b\nimport c as d\nfrom .x import (y,\n  z as w)\nfrom . import utils\nfrom m import *\n";
    const imps = pythonImports(logicalLines(maskPython(text)));
    expect(imps.map((i) => [i.local, i.module, i.level, i.name ?? null])).toEqual([
      ["a.b", "a.b", 0, null],
      ["d", "c", 0, null],
      ["y", "x", 1, "y"],
      ["w", "x", 1, "z"],
      ["utils", "", 1, "utils"],
      ["*", "m", 0, "*"],
    ]);
  });
  it("resolves absolute, relative, submodule and re-exported names to repo files", () => {
    const r = pyResolver(fs);
    const [a, b, c, d] = pythonImports(
      logicalLines(
        maskPython(
          "from pkg import Command\nfrom . import utils\nfrom helpers import format_name\nimport os\n",
        ),
      ),
    );
    if (!a || !b || !c || !d) throw new Error("imports");
    expect(r.target(a, "tests/test_x.py")).toEqual({ kind: "symbol", key: "src/pkg/core.py::Command" });
    expect(r.target(b, "src/pkg/core.py")).toEqual({ kind: "module", file: "src/pkg/utils.py" });
    expect(r.target(c, "app/main.py")).toEqual({ kind: "symbol", key: "helpers.py::format_name" });
    expect(r.target(d, "app/main.py")).toBeNull();
  });
});

describe("diffPython", () => {
  const HELPERS = `def format_name(first, last):
    return f"{first} {last}"


def other():
    return 1
`;
  const r = pyResolver(memFs({ "helpers.py": HELPERS }));

  it("reports a signature change, with the edit's line range", () => {
    const after = HELPERS.replace("format_name(first, last)", "format_name(first, last, *, title)");
    const d = diffPython("helpers.py", HELPERS, after, r);
    expect(d.touches).toEqual([
      { path: "helpers.py", symbol: "helpers.py::format_name", op: "signature_change", lines: [1, 1] },
    ]);
  });

  it("reports a body edit as write and leaves neighbours alone", () => {
    const after = HELPERS.replace("return 1", "return 2");
    const d = diffPython("helpers.py", HELPERS, after, r);
    expect(d.touches).toEqual([
      { path: "helpers.py", symbol: "helpers.py::other", op: "write", lines: [6, 6] },
    ]);
  });

  it("reports an edit that only changes a string literal", () => {
    const d = diffPython(
      "helpers.py",
      HELPERS,
      HELPERS.replace('f"{first} {last}"', 'f"{last}, {first}"'),
      r,
    );
    expect(d.touches.map((t) => [t.symbol, t.op])).toEqual([["helpers.py::format_name", "write"]]);
  });

  it("reports renames in place, creates and deletes", () => {
    const renamed = diffPython("helpers.py", HELPERS, HELPERS.replace("def other", "def another"), r);
    expect(renamed.touches.map((t) => [t.symbol, t.op])).toEqual([
      ["helpers.py::other", "rename"],
      ["helpers.py::another", "create"],
    ]);
    const deleted = diffPython("helpers.py", HELPERS, HELPERS.replace(/\n\ndef other[\s\S]*$/, "\n"), r);
    expect(deleted.touches).toEqual([
      { path: "helpers.py", symbol: "helpers.py::other", op: "delete", lines: [5, 6] },
    ]);
    const created = diffPython("new.py", null, "class A:\n    def m(self):\n        pass\n", r);
    expect(created.touches.map((t) => [t.symbol, t.op])).toEqual([["new.py::A", "create"]]);
  });

  it("reports the edited method, not its class, and resolves self calls and imports", () => {
    const before =
      "from helpers import format_name\n\nclass A:\n    def m(self):\n        return 1\n\n    def n(self):\n        return 2\n";
    const after = before.replace("return 1", "return self.n() + format_name('a', 'b')");
    const d = diffPython("app.py", before, after, r);
    expect(d.touches.map((t) => [t.symbol, t.op])).toEqual([["app.py::A.m", "write"]]);
    expect(d.references.sort()).toEqual(["app.py::A.n", "helpers.py::format_name"]);
  });

  it("parses a 2k-line file pair quickly", () => {
    const body = Array.from(
      { length: 400 },
      (_, i) => `def f${i}(a, b=1):\n    """doc"""\n    x = g(a)\n    return x\n`,
    ).join("\n");
    const before = `import os\n${body}`;
    const after = before.replace("def f200(a, b=1)", "def f200(a, b, c)");
    const started = performance.now();
    const d = diffPython("big.py", before, after, r);
    const ms = performance.now() - started;
    expect(d.touches).toContainEqual(
      expect.objectContaining({ symbol: "big.py::f200", op: "signature_change" }),
    );
    expect(ms).toBeLessThan(50);
  });
});
