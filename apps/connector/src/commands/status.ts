import { existsSync, readFileSync } from "node:fs";
import { activeProfile, loadConfig } from "../config";
import { outboxPath } from "../hook/outbox";

function outboxCount(): number {
  try {
    return existsSync(outboxPath())
      ? readFileSync(outboxPath(), "utf8").split("\n").filter(Boolean).length
      : 0;
  } catch {
    return 0;
  }
}

async function reachability(siteUrl: string): Promise<string> {
  const started = Date.now();
  try {
    const res = await fetch(`${siteUrl}/health`, { signal: AbortSignal.timeout(1500) });
    return `reachable (HTTP ${res.status}, ${Date.now() - started} ms)`;
  } catch (e) {
    return `unreachable (${e instanceof Error ? e.message : String(e)})`;
  }
}

export async function statusCommand(): Promise<void> {
  const cfg = loadConfig();
  const p = activeProfile();
  if (!p) {
    console.log("not joined — run: lb join --url <siteUrl> --as <handle>");
    return;
  }
  console.log(
    `profile:  ${p.handle}${Object.keys(cfg.profiles).length > 1 ? ` (of ${Object.keys(cfg.profiles).join(", ")})` : ""}`,
  );
  console.log(`site:     ${p.siteUrl}`);
  console.log(`convex:   ${p.convexUrl || "-"}`);
  console.log(`backend:  ${await reachability(p.siteUrl)}`);
  console.log(`outbox:   ${outboxCount()} queued`);
}
