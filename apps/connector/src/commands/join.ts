import { hostname } from "node:os";
import { z } from "zod";
import { loadConfig, saveConfig } from "../config";
import { HttpError, postJson } from "../http";

// `handle` is absent on the legacy invite path: the caller already chose it with --as.
const JoinResponse = z.object({
  token: z.string(),
  convexUrl: z.string(),
  siteUrl: z.string().optional(),
  webUrl: z.string().nullish(),
  handle: z.string().optional(),
});

export type JoinOptions = { url: string; token?: string; invite?: string; as?: string; name?: string };

type JoinRequest = { body: Record<string, string>; handle?: string };

const trimSlash = (u: string): string => u.replace(/\/+$/, "");

/** A connect token (minted per laptop on the website) wins; the shared invite code is for local e2e. */
export function joinRequest(opts: JoinOptions, machine = hostname()): JoinRequest {
  if (opts.token) return { body: { token: opts.token, machine }, handle: opts.as };
  if (opts.invite && opts.as)
    return { body: { invite: opts.invite, handle: opts.as, name: opts.name ?? opts.as }, handle: opts.as };
  throw new Error("pass --token <connectToken> (from the website), or --invite <code> --as <handle>");
}

async function post(url: string, body: Record<string, string>): Promise<unknown> {
  try {
    return await postJson(url, body);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401)
      throw new Error("connect token is invalid, used or expired; get a fresh one from the website");
    if (e instanceof HttpError && e.status === 403)
      throw new Error("invite codes are disabled on this backend; use --token from the website");
    throw e;
  }
}

/**
 * `url` may be the web app (it forwards /join) or the Convex site; the response names the Convex
 * site, which is where hooks and MCP post from then on.
 */
export async function joinCommand(opts: JoinOptions): Promise<void> {
  const url = trimSlash(opts.url);
  const req = joinRequest(opts);
  const res = JoinResponse.parse(await post(`${url}/join`, req.body));
  const handle = res.handle ?? req.handle;
  if (!handle) throw new Error("backend did not return a handle; retry with --as <handle>");
  const cfg = loadConfig();
  cfg.siteUrl = trimSlash(res.siteUrl ?? url);
  cfg.convexUrl = res.convexUrl;
  cfg.webUrl = res.webUrl ? trimSlash(res.webUrl) : cfg.webUrl;
  cfg.current = handle;
  cfg.profiles[handle] = { token: res.token };
  saveConfig(cfg);
  console.log(`joined as ${handle} → ${cfg.siteUrl}`);
}
