import { IngestEnvelope } from "@lb/core";
import { httpRouter } from "convex/server";
import { z } from "zod";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { sha256Hex } from "./hash";
import { join } from "./httpJoin";
import { bearerToken } from "./tokenAuth";
import { VerifyBody } from "./verify";

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

const hook = httpAction(async (ctx, req) => {
  const t0 = Date.now();
  const tokenHash = await tokenHashOf(req);
  if (!tokenHash) return json(401, { error: "missing token" });
  const name = new URL(req.url).pathname.slice("/hook/".length);
  const envelope = IngestEnvelope.safeParse(await readJson(req));
  if (!name || !envelope.success) return json(400, { error: envelope.error?.message ?? "missing hook name" });
  const t1 = Date.now();
  const res = await ctx.runMutation(internal.events.ingest, {
    tokenHash,
    hook: name,
    envelope: envelope.data,
  });
  const t2 = Date.now();
  const out =
    res.status === 200 ? json(200, { output: res.output }) : json(res.status, { error: "unauthorized" });
  // Lets `lb hook` timing split a slow deliver into network, request parsing and the ingest mutation.
  out.headers.set("server-timing", `parse;dur=${t1 - t0}, ingest;dur=${t2 - t1}`);
  return out;
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

const AttachBody = z.object({ code: z.string().min(4).max(40) });

/** `/little-brother:join <code>`: 200 joined, 202 waiting for the host, 403 denied, 404 unknown or ended. */
const attach = httpAction(async (ctx, req) => {
  const tokenHash = await tokenHashOf(req);
  if (!tokenHash) return json(401, { error: "missing token" });
  const body = AttachBody.safeParse(await readJson(req));
  if (!body.success) return json(400, { error: body.error.message });
  try {
    const s = await ctx.runMutation(internal.sessions.attach, { tokenHash, code: body.data.code });
    if (!s) return json(404, { error: "no open session with that code" });
    return json(s.status === "joined" ? 200 : s.status === "pending" ? 202 : 403, s);
  } catch {
    return json(401, { error: "unauthorized" });
  }
});

const verify = httpAction(async (ctx, req) => {
  const tokenHash = await tokenHashOf(req);
  if (!tokenHash) return json(401, { text: "missing token" });
  const body = VerifyBody.safeParse(await readJson(req));
  if (!body.success) return json(400, { text: body.error.message });
  const res = await ctx.runMutation(internal.verify.record, { tokenHash, body: body.data });
  return json(res.status, { text: res.text });
});

const AskCreate = z.object({
  claudeSessionId: z.string(),
  toolUseId: z.string().optional(),
  questions: z
    .array(
      z.object({
        question: z.string().max(2000),
        header: z.string().max(200).optional(),
        multiSelect: z.boolean().optional(),
        options: z
          .array(z.object({ label: z.string().max(500), description: z.string().max(2000).optional() }))
          .max(10),
      }),
    )
    .min(1)
    .max(6),
});
const AskId = z.object({ id: z.string() });

/** `lb ask`: create (200 {id} or {id:null} → ask in the terminal), poll status, or give up. */
const ask = httpAction(async (ctx, req) => {
  const tokenHash = await tokenHashOf(req);
  if (!tokenHash) return json(401, { error: "missing token" });
  const op = new URL(req.url).pathname.slice("/ask/".length);
  const raw = await readJson(req);
  if (op === "create") {
    const body = AskCreate.safeParse(raw);
    if (!body.success) return json(400, { error: body.error.message });
    const id = await ctx.runMutation(internal.ask.create, { tokenHash, ...body.data });
    return json(200, { id });
  }
  const body = AskId.safeParse(raw);
  if (!body.success) return json(400, { error: body.error.message });
  if (op === "status")
    return json(200, (await ctx.runQuery(internal.ask.status, { tokenHash, id: body.data.id })) ?? {});
  if (op === "expire")
    return json(200, await ctx.runMutation(internal.ask.expire, { tokenHash, id: body.data.id }));
  return json(404, { error: "unknown op" });
});

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/join", method: "POST", handler: join });
http.route({ pathPrefix: "/hook/", method: "POST", handler: hook });
http.route({ pathPrefix: "/mcp/", method: "POST", handler: mcp });
http.route({ path: "/session/attach", method: "POST", handler: attach });
http.route({ path: "/verify", method: "POST", handler: verify });
http.route({ pathPrefix: "/ask/", method: "POST", handler: ask });
http.route({ path: "/health", method: "GET", handler: httpAction(async () => new Response("ok")) });

export default http;
