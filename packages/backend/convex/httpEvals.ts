import { constantTimeEqual, EvalBatchConfig, EvalRunPost } from "@lb/core";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { sha256Hex } from "./hash";
import { bearerToken } from "./tokenAuth";

// The eval harness's live stream (apps/evals live-publish.ts): a batch's plan and finish, and each run as
// soon as it is graded. Writes go through the same idempotent ingest as the after-the-fact publisher.

// Convex injects env vars at runtime; the convex tsconfig deliberately omits node types.
declare const process: { env: Record<string, string | undefined> };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** Null when the caller holds the shared ingest secret, else the response to send back. */
async function rejection(req: Request): Promise<Response | null> {
  const secret = process.env.EVAL_INGEST_TOKEN;
  // Unset means nobody may write: a fresh deployment must not accept anonymous eval rows.
  if (!secret) return json(503, { error: "eval ingest is not configured" });
  const presented = bearerToken(req);
  // Hashing first makes both sides the same length, so the comparison leaks nothing about the secret.
  if (!presented || !constantTimeEqual(await sha256Hex(presented), await sha256Hex(secret)))
    return json(401, { error: "unauthorized" });
  return null;
}

export const evalBatchPost = httpAction(async (ctx, req) => {
  const denied = await rejection(req);
  if (denied) return denied;
  const body = EvalBatchConfig.safeParse(await readJson(req));
  if (!body.success) return json(400, { error: body.error.message });
  return json(200, await ctx.runMutation(internal.evalBoard.upsertBatch, { config: body.data }));
});

export const evalRunPost = httpAction(async (ctx, req) => {
  const denied = await rejection(req);
  if (denied) return denied;
  const body = EvalRunPost.safeParse(await readJson(req));
  if (!body.success) return json(400, { error: body.error.message });
  const { row, replay } = body.data;
  const res = await ctx.runMutation(internal.evalBoard.ingestRuns, { rows: [row] });
  if (replay) await ctx.runMutation(internal.evalBoard.ingestReplay, { replay, featured: false });
  return json(200, { ...res, replay: replay !== null });
});
