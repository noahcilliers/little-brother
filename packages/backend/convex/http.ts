import { IngestEnvelope } from "@lb/core";
import { httpRouter } from "convex/server";
import { z } from "zod";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { bearerToken } from "./auth";
import { randomToken, sha256Hex } from "./hash";
import { VerifyBody } from "./verify";

// Convex injects env vars at runtime; the convex tsconfig deliberately omits node types.
declare const process: { env: Record<string, string | undefined> };

const JoinBody = z.object({
  invite: z.string(),
  handle: z.string().min(1).max(40),
  name: z.string().max(80).optional(),
});
const McpBody = z.object({ claudeSessionId: z.string().default(""), args: z.unknown().default({}) });

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function tokenHashOf(req: Request): Promise<string | null> {
  const token = bearerToken(req);
  return token ? sha256Hex(token) : null;
}

const join = httpAction(async (ctx, req) => {
  const body = JoinBody.safeParse(await readJson(req));
  if (!body.success) return json(400, { error: body.error.message });
  if (body.data.invite !== (process.env.LB_INVITE_CODE ?? "calhacks"))
    return json(403, { error: "bad invite" });
  const token = randomToken();
  await ctx.runMutation(internal.members.join, {
    handle: body.data.handle,
    name: body.data.name,
    tokenHash: await sha256Hex(token),
  });
  return json(200, { token, convexUrl: process.env.CONVEX_CLOUD_URL, siteUrl: process.env.CONVEX_SITE_URL });
});

const hook = httpAction(async (ctx, req) => {
  const tokenHash = await tokenHashOf(req);
  if (!tokenHash) return json(401, { error: "missing token" });
  const name = new URL(req.url).pathname.slice("/hook/".length);
  const envelope = IngestEnvelope.safeParse(await readJson(req));
  if (!name || !envelope.success) return json(400, { error: envelope.error?.message ?? "missing hook name" });
  const res = await ctx.runMutation(internal.events.ingest, {
    tokenHash,
    hook: name,
    envelope: envelope.data,
  });
  return res.status === 200 ? json(200, { output: res.output }) : json(res.status, { error: "unauthorized" });
});

const mcp = httpAction(async (ctx, req) => {
  const tokenHash = await tokenHashOf(req);
  if (!tokenHash) return json(401, { text: "missing token" });
  const tool = new URL(req.url).pathname.slice("/mcp/".length);
  const body = McpBody.safeParse(await readJson(req));
  if (!body.success) return json(400, { text: body.error.message });
  const res = await ctx.runMutation(internal.mcp.call, {
    tokenHash,
    tool,
    claudeSessionId: body.data.claudeSessionId,
    args: body.data.args ?? {},
  });
  return json(res.status, { text: res.text });
});

const verify = httpAction(async (ctx, req) => {
  const tokenHash = await tokenHashOf(req);
  if (!tokenHash) return json(401, { text: "missing token" });
  const body = VerifyBody.safeParse(await readJson(req));
  if (!body.success) return json(400, { text: body.error.message });
  const res = await ctx.runMutation(internal.verify.record, { tokenHash, body: body.data });
  return json(res.status, { text: res.text });
});

const http = httpRouter();
http.route({ path: "/join", method: "POST", handler: join });
http.route({ pathPrefix: "/hook/", method: "POST", handler: hook });
http.route({ pathPrefix: "/mcp/", method: "POST", handler: mcp });
http.route({ path: "/verify", method: "POST", handler: verify });
http.route({ path: "/health", method: "GET", handler: httpAction(async () => new Response("ok")) });

export default http;
