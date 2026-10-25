import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lbHome, loadConfig } from "../config";

// Downloads the site's lb.mjs and swaps it in place. Done in-process (not `curl | sh`): a piped shell can be
// killed or sandboxed without a word, and an update that fails silently leaves teammates on old code.

const TIMEOUT_MS = 120_000;

export async function updateCommand(): Promise<void> {
  const site = (process.env.LB_ORIGIN ?? loadConfig().webUrl).replace(/\/+$/, "");
  if (!site)
    throw new Error("no site saved yet: run `lb join` first, or set LB_ORIGIN to the Little Brother site");
  const res = await fetch(`${site}/lb.mjs`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status} from ${site}/lb.mjs`);
  const body = await res.text();
  const dir = join(lbHome(), "bin");
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `lb.next-${process.pid}.mjs`);
  writeFileSync(tmp, body);
  // Refuse a download that doesn't run, so a bad deploy can't break every hook on this laptop.
  const version = execFileSync(process.execPath, [tmp, "--version"], {
    encoding: "utf8",
    timeout: 20_000,
  }).trim();
  renameSync(tmp, join(dir, "lb.mjs"));
  console.log(`lb updated to ${version} from ${site}`);
}
