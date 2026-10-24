import { describe, expect, it } from "vitest";
import { diffTouches, parseUnifiedDiff } from "../src/classify/diff-touches";

const DIFF = `diff --git a/app/text.py b/app/text.py
index 1..2 100644
--- a/app/text.py
+++ b/app/text.py
@@ -10,7 +10,7 @@ def phone2numeric(phone):
     letters = MAP
-    return "".join(letters.get(c, c) for c in phone)
+    return "".join(letters.get(c, c) for c in phone.lower())
@@ -40,3 +40,4 @@ class Truncator:
-def wrap(text, width):
+def wrap(text, width, *, strict=False):
+    return wrap_lines(text, width)
diff --git a/app/new_util.py b/app/new_util.py
new file mode 100644
--- /dev/null
+++ b/app/new_util.py
@@ -0,0 +1,3 @@
+from app.text import phone2numeric
+def clean(phone):
+    return phone2numeric(phone.replace("-", ""))
diff --git a/package-lock.json b/package-lock.json
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,1 +1,1 @@
-x
+y
`;

describe("diff → touches", () => {
  it("splits a git diff per file with its status", () => {
    const files = parseUnifiedDiff(DIFF);
    expect(files.map((f) => [f.path, f.status])).toEqual([
      ["app/text.py", "modified"],
      ["app/new_util.py", "added"],
      ["package-lock.json", "modified"],
    ]);
  });

  it("gives base-side line ranges, enclosing and changed definitions, and signature changes", () => {
    const { touches, references } = diffTouches(parseUnifiedDiff(DIFF));
    const sym = (s: string) => touches.find((t) => t.symbol === s);
    expect(touches.find((t) => t.path === "app/text.py" && !t.symbol)?.lines).toEqual([10, 16]);
    expect(sym("app/text.py::phone2numeric")?.op).toBe("write");
    expect(sym("app/text.py::wrap")?.op).toBe("signature_change");
    expect(sym("app/new_util.py::clean")).toMatchObject({ op: "create", lines: [1, 3] });
    expect(touches.find((t) => t.path === "package-lock.json")?.generated).toBe(true);
    expect(references).toContain("phone2numeric");
    expect(references).toContain("wrap_lines");
    expect(references).not.toContain("clean");
  });
});
