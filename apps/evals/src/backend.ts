import { z } from "zod";
import { convexEnv } from "./convex-target";
import { sh } from "./exec";

// Talks to the local Convex deployment through `convex run`, which can call the internal eval functions.

const Snapshot = z.object({
  code: z.string(),
  agents: z.array(
    z.object({
      handle: z.string(),
      claudeSessionId: z.string(),
      status: z.string(),
      events: z.number(),
      firstEventAt: z.number().nullable(),
      firstEditAt: z.number().nullable(),
    }),
  ),
  classifications: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      relation: z.string(),
      action: z.string(),
      source: z.string(),
      agents: z.array(z.string()),
      confidence: z.number(),
      reason: z.string(),
      evidence: z.array(z.string()),
      nodeKind: z.string(),
      nodeText: z.string(),
      againstText: z.string().nullable(),
      inbox: z.number(),
      latencyMs: z.number(),
      tokensSaved: z.number().nullable().optional(),
      catchKey: z.string().nullable().optional(),
      at: z.number(),
    }),
  ),
});
export type Snapshot = z.infer<typeof Snapshot>;

export type Backend = { dir: string; siteUrl: string };

function run(b: Backend, fn: string, args: Record<string, unknown>): unknown {
  const env = convexEnv(b);
  const r = sh("npx", ["convex", "run", fn, JSON.stringify(args)], b.dir, env);
  if (!r.ok) throw new Error(`convex run ${fn} failed: ${r.out.trim().slice(-600)}`);
  const start = r.out.search(/[[{]|^null/m);
  return JSON.parse(start >= 0 ? r.out.slice(start) : "null");
}

export async function healthy(b: Backend): Promise<boolean> {
  try {
    const res = await fetch(`${b.siteUrl}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export const openRun = (b: Backend, code: string, name: string): void => {
  run(b, "evals:openRun", { code, name });
};

export const closeRun = (b: Backend, code: string): void => {
  run(b, "evals:closeRun", { code });
};

export function snapshot(b: Backend, code: string): Snapshot {
  const parsed = Snapshot.nullable().parse(run(b, "evals:snapshot", { code }));
  if (!parsed) throw new Error(`no session ${code} on the backend`);
  return parsed;
}

/** Which classifier tiers the deployment can run, for the report header. Values are never read. */
export function describeBackend(b: Backend): string {
  const env = convexEnv(b);
  const r = sh("npx", ["convex", "env", "list"], b.dir, env);
  const names = new Set(r.out.split("\n").map((l) => l.split("=")[0]?.trim() ?? ""));
  const has = (k: string) => names.has(k);
  const value = (k: string) =>
    r.out
      .split("\n")
      .find((l) => l.startsWith(`${k}=`))
      ?.slice(k.length + 1)
      .trim();
  const judge = value("CLASSIFIER_JUDGE") ?? "gemini";
  const judgeOn =
    (judge === "gemini" && has("GEMINI_API_KEY")) || (judge === "claude" && has("ANTHROPIC_API_KEY"));
  const embedOn = (value("CLASSIFIER_EMBEDDER") ?? "gemini") === "gemini" && has("GEMINI_API_KEY");
  return `${b.siteUrl} · judge ${judgeOn ? judge : "off"} · embeddings ${embedOn ? "gemini" : "off"} · open mode ${has("LB_ALLOW_INVITE") ? "on" : "off"}`;
}
