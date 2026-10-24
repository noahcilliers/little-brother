import { spawnSync } from "node:child_process";
import { loadConfig } from "../config";

/** Re-runs the site's installer, which replaces lb.mjs in place; the saved profile is untouched. */
export function updateCommand(): void {
  const site = process.env.LB_ORIGIN ?? loadConfig().webUrl;
  if (!site)
    throw new Error("no site saved yet: run `lb join` first, or set LB_ORIGIN to the Little Brother site");
  const r = spawnSync("sh", ["-c", `curl -fsSL "${site.replace(/\/+$/, "")}/install.sh" | sh`], {
    stdio: "inherit",
  });
  process.exitCode = r.status ?? 1;
}
