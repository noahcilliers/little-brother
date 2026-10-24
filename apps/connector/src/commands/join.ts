import { z } from "zod";
import { loadConfig, saveConfig } from "../config";
import { postJson } from "../http";

const JoinResponse = z.object({ token: z.string(), convexUrl: z.string(), siteUrl: z.string().optional() });

export type JoinOptions = { url: string; as: string; name?: string; invite: string };

export async function joinCommand(opts: JoinOptions): Promise<void> {
  const siteUrl = opts.url.replace(/\/+$/, "");
  const res = JoinResponse.parse(
    await postJson(`${siteUrl}/join`, { invite: opts.invite, handle: opts.as, name: opts.name ?? opts.as }),
  );
  const cfg = loadConfig();
  cfg.siteUrl = (res.siteUrl ?? siteUrl).replace(/\/+$/, "");
  cfg.convexUrl = res.convexUrl;
  cfg.current = opts.as;
  cfg.profiles[opts.as] = { token: res.token };
  saveConfig(cfg);
  console.log(`joined as ${opts.as} → ${cfg.siteUrl}`);
}
