import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const LocalConfig = z.object({ deploymentName: z.string() });

/** Deployments evals must never write to; open-run rooms and eval sessions would land in real data. */
const FORBIDDEN = [/^prod:/, /fantastic-meerkat-18/];

export const isLocalSite = (siteUrl: string): boolean =>
  /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(siteUrl);

/**
 * Which deployment `convex run` targets, refusing anything that looks like production. For a local site
 * this is the anonymous local deployment by name: `.env.local` may point CONVEX_DEPLOYMENT at a cloud dev
 * deployment, and the CLI prefers that over CONVEX_AGENT_MODE, so the harness would read the wrong backend.
 */
export function convexDeployment(backendDir: string, siteUrl: string): string | null {
  const explicit = process.env.LB_EVAL_CONVEX_DEPLOYMENT;
  let picked: string | null = explicit ?? null;
  const localConfig = join(backendDir, ".convex/local/default/config.json");
  if (!picked && isLocalSite(siteUrl) && existsSync(localConfig)) {
    const parsed = LocalConfig.safeParse(JSON.parse(readFileSync(localConfig, "utf8")));
    if (parsed.success) picked = `anonymous:${parsed.data.deploymentName}`;
  }
  if (picked && FORBIDDEN.some((re) => re.test(picked ?? "")))
    throw new Error(`refusing to run evals against ${picked}: use a local deployment`);
  return picked;
}

export function convexEnv(b: { dir: string; siteUrl: string }): NodeJS.ProcessEnv {
  const deployment = convexDeployment(b.dir, b.siteUrl);
  return {
    ...process.env,
    CONVEX_AGENT_MODE: process.env.CONVEX_AGENT_MODE ?? "anonymous",
    ...(deployment ? { CONVEX_DEPLOYMENT: deployment } : {}),
  };
}
