import { z } from "zod";
import { loadConfig, saveConfig } from "../config";
import { postJson } from "../http";

// `handle` is absent on the invite path: the caller already chose it with --as.
const JoinResponse = z.object({
  token: z.string(),
  convexUrl: z.string(),
  siteUrl: z.string().optional(),
  handle: z.string().optional(),
});

export type JoinOptions = { url: string; token?: string; invite?: string; as?: string; name?: string };

type JoinRequest = { body: Record<string, string>; handle?: string };

/** A connect token (minted per laptop on the website) wins; the shared invite code is for local e2e. */
export function joinRequest(opts: JoinOptions): JoinRequest {
  if (opts.token) return { body: { token: opts.token }, handle: opts.as };
  if (opts.invite && opts.as)
    return { body: { invite: opts.invite, handle: opts.as, name: opts.name ?? opts.as }, handle: opts.as };
  throw new Error("pass --token <connectToken> (from the website), or --invite <code> --as <handle>");
}

export async function joinCommand(opts: JoinOptions): Promise<void> {
  const siteUrl = opts.url.replace(/\/+$/, "");
  const req = joinRequest(opts);
  const res = JoinResponse.parse(await postJson(`${siteUrl}/join`, req.body));
  const handle = res.handle ?? req.handle;
  if (!handle) throw new Error("backend did not return a handle; retry with --as <handle>");
  const cfg = loadConfig();
  cfg.siteUrl = (res.siteUrl ?? siteUrl).replace(/\/+$/, "");
  cfg.convexUrl = res.convexUrl;
  cfg.current = handle;
  cfg.profiles[handle] = { token: res.token };
  saveConfig(cfg);
  console.log(`joined as ${handle} → ${cfg.siteUrl}`);
}
