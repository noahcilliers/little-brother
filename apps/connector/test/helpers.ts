import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export function tempRepo(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "lb-test-"));
  mkdirSync(join(root, ".git"));
  writeFileSync(join(root, ".git", "HEAD"), "ref: refs/heads/noah/auth\n");
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), content);
  }
  return root;
}

export function tempHome(config?: unknown): string {
  const home = mkdtempSync(join(tmpdir(), "lb-home-"));
  if (config) writeFileSync(join(home, "config.json"), JSON.stringify(config));
  return home;
}
