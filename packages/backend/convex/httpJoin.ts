import { z } from "zod";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { openMode } from "./access";
import { randomToken, sha256Hex } from "./hash";

// Convex injects env vars at runtime; the convex tsconfig deliberately omits node types.
declare const process: { env: Record<string, string | undefined> };

/** `lb join --token <t>`: a connect token created on /start. */
const TokenJoin = z.object({ token: z.string().min(8).max(200), machine: z.string().max(80).optional() });
/** Legacy shared invite code; only honoured with LB_ALLOW_INVITE=1 (local e2e). */
const InviteJoin = z.object({
  invite: z.string(),
  handle: z.string().min(1).max(40),
  name: z.string().max(80).optional(),
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const urls = () => ({
  convexUrl: process.env.CONVEX_CLOUD_URL,
  siteUrl: process.env.CONVEX_SITE_URL,
  webUrl: process.env.SITE_URL ?? null,
});

export const join = httpAction(async (ctx, req) => {
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "body must be JSON" });
  }
  const byToken = TokenJoin.safeParse(raw);
  if (byToken.success) {
    const token = `lbt_${randomToken()}`;
    const joined = await ctx.runMutation(internal.devices.redeem, {
      connectHash: await sha256Hex(byToken.data.token),
      tokenHash: await sha256Hex(token),
      machine: byToken.data.machine,
    });
    if (!joined) return json(401, { error: "connect token is invalid, used or expired; create a new one on /start" });
    return json(200, { token, handle: joined.handle, name: joined.name, ...urls() });
  }
  const byInvite = InviteJoin.safeParse(raw);
  if (!byInvite.success) return json(400, { error: "expected {token} from `lb join --token <t>`" });
  if (!openMode()) return json(403, { error: "invite codes are disabled; create a connect token on /start" });
  if (byInvite.data.invite !== (process.env.LB_INVITE_CODE ?? "calhacks"))
    return json(403, { error: "bad invite" });
  const token = randomToken();
  await ctx.runMutation(internal.members.join, {
    handle: byInvite.data.handle,
    name: byInvite.data.name,
    tokenHash: await sha256Hex(token),
  });
  return json(200, { token, handle: byInvite.data.handle, name: byInvite.data.name ?? byInvite.data.handle, ...urls() });
});
