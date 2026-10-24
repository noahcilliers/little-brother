import { describe, expect, it } from "vitest";
import { shellWrites } from "../src/shell-writes";

describe("shellWrites", () => {
  it("reads a heredoc create as a write with the body as content", () => {
    const cmd =
      "mkdir -p src/contracts && cat > src/contracts/order.ts <<'E'\nexport type Order = { id: string };\nE";
    expect(shellWrites(cmd)).toEqual([
      { path: "src/contracts/order.ts", append: false, content: "export type Order = { id: string };\n" },
    ]);
  });

  it("finds every heredoc file in one command, and does not parse bodies as shell", () => {
    const cmd = [
      "cat > a.ts << 'EOF'",
      "if (x > 1) echo 'oops' > b.ts",
      "EOF",
      'cat <<"EOF" >> c.ts',
      "line",
      "EOF",
    ].join("\n");
    expect(shellWrites(cmd)).toEqual([
      { path: "a.ts", append: false, content: "if (x > 1) echo 'oops' > b.ts\n" },
      { path: "c.ts", append: true, content: "line\n" },
    ]);
  });

  it("strips leading tabs for <<- and keeps unquoted-delimiter bodies", () => {
    expect(shellWrites("cat <<-END > f.txt\n\thello\n\tEND")).toEqual([
      { path: "f.txt", append: false, content: "hello\n" },
    ]);
  });

  it("handles echo, printf and here-strings", () => {
    expect(shellWrites('echo "hi there" > a.txt; printf "%s" x >> b.txt; cat <<< "s" > c.txt')).toEqual([
      { path: "a.txt", append: false, content: "hi there\n" },
      { path: "b.txt", append: true },
      { path: "c.txt", append: false, content: "s\n" },
    ]);
    expect(shellWrites("echo -n x > a")).toEqual([{ path: "a", append: false, content: "x" }]);
    expect(shellWrites('echo -e "a\\nb" > a')).toEqual([{ path: "a", append: false }]);
    expect(shellWrites("echo $HOME > a")).toEqual([{ path: "a", append: false }]);
  });

  it("follows tee, with -a and piped heredoc content", () => {
    expect(shellWrites("cat <<'E' | tee src/x.ts > /dev/null\nbody\nE")).toEqual([
      { path: "src/x.ts", append: false, content: "body\n" },
    ]);
    expect(shellWrites("npm test 2>&1 | tee -a log.txt")).toEqual([{ path: "log.txt", append: true }]);
  });

  it("skips fd duplication, stderr, /dev/null and dynamic targets", () => {
    expect(
      shellWrites("npm test 2>&1 >/dev/null; ls 2> err.log; echo x > $OUT; echo y > ~/z; cmd >&2"),
    ).toEqual([]);
  });

  it("treats &> and >| as stdout writes", () => {
    expect(shellWrites("build &> out.log; echo a >| f")).toEqual([
      { path: "out.log", append: false },
      { path: "f", append: false, content: "a\n" },
    ]);
  });

  it("joins paths onto a literal cd and drops relative paths after an unknown one", () => {
    expect(shellWrites("cd apps/web && echo a > x.ts")).toEqual([
      { path: "apps/web/x.ts", append: false, content: "a\n" },
    ]);
    expect(shellWrites("cd $DIR && echo a > x.ts && echo b > /abs/y")).toEqual([
      { path: "/abs/y", append: false, content: "b\n" },
    ]);
    expect(shellWrites("cd $DIR; cd /repo; echo a > x")).toEqual([
      { path: "/repo/x", append: false, content: "a\n" },
    ]);
  });

  it("ignores redirects inside command substitutions, comments, quotes and commit-message heredocs", () => {
    const commit = [
      "git commit -m \"$(cat <<'EOF'",
      "Don't break: a > b when (x",
      "EOF",
      ')"',
      "echo done > ok.txt",
    ].join("\n");
    expect(shellWrites(commit)).toEqual([{ path: "ok.txt", append: false, content: "done\n" }]);
    expect(shellWrites("x=$(echo a > hidden) # echo b > c\necho '> d' \"> e\"")).toEqual([]);
    expect(shellWrites("echo $((1 > 2))")).toEqual([]);
  });

  it("keeps quoted targets and skips leading assignments", () => {
    expect(shellWrites("FOO=1 cat > 'my file.ts' <<E\nx\nE")).toEqual([
      { path: "my file.ts", append: false, content: "x\n" },
    ]);
  });

  it("returns nothing for commands without writes, and never throws on junk", () => {
    expect(shellWrites("npm test && git status")).toEqual([]);
    expect(shellWrites("cat < in.txt")).toEqual([]);
    expect(() => shellWrites('echo "unterminated > x\ncat <<E')).not.toThrow();
  });
});
