import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const Profile = z.object({ token: z.string() });
export const Config = z.object({
  siteUrl: z.string().default(""),
  convexUrl: z.string().default(""),
  current: z.string().default(""),
  profiles: z.record(Profile).default({}),
});
export type Config = z.infer<typeof Config>;

export type ActiveProfile = { handle: string; token: string; siteUrl: string; convexUrl: string };

export function lbHome(): string {
  return process.env.LB_HOME ?? join(homedir(), ".little-brother");
}

export function configPath(): string {
  return join(lbHome(), "config.json");
}

export function loadConfig(): Config {
  try {
    return Config.parse(JSON.parse(readFileSync(configPath(), "utf8")));
  } catch {
    return Config.parse({});
  }
}

export function saveConfig(cfg: Config): void {
  mkdirSync(lbHome(), { recursive: true });
  writeFileSync(configPath(), `${JSON.stringify(cfg, null, 2)}\n`, { mode: 0o600 });
}

/** `as` wins over LB_PROFILE, which wins over the saved `current`. */
export function activeProfile(as?: string): ActiveProfile | null {
  const cfg = loadConfig();
  const handle = as ?? process.env.LB_PROFILE ?? cfg.current;
  const p = cfg.profiles[handle];
  if (!p || !cfg.siteUrl) return null;
  return { handle, token: p.token, siteUrl: cfg.siteUrl.replace(/\/+$/, ""), convexUrl: cfg.convexUrl };
}
