import { consumedTopics, type IngestEnvelope, normalizeCommand, TopicMap, type VerbDef } from "@lb/core";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { sha1Hex } from "./hash";

type NewNode = Omit<Doc<"nodes">, "_id" | "_creationTime" | "touches" | "references" | "files"> &
  Partial<Pick<Doc<"nodes">, "touches" | "references" | "files">>;

export function insertNode(ctx: MutationCtx, node: NewNode): Promise<Id<"nodes">> {
  return ctx.db.insert("nodes", { files: [], touches: [], references: [], ...node });
}

export async function activeVerbs(ctx: QueryCtx): Promise<VerbDef[]> {
  const rows = await ctx.db.query("verbs").collect();
  return rows
    .filter((r) => r.status === "active")
    .map((r) => ({
      key: r.key,
      description: r.description,
      priority: r.priority,
      match: r.match.map((m) => ({
        tool: m.tool,
        input: m.input,
        after: m.after,
        outcome: m.outcome === "ok" || m.outcome === "fail" ? m.outcome : undefined,
      })),
    }));
}

function globToRegExp(glob: string): RegExp {
  const segment = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  const pattern = glob
    .split("**/")
    .map((part) => part.split("**").map(segment).join(".*"))
    .join("(?:.*/)?");
  return new RegExp(`^${pattern}$`);
}

/** Topic map lives in `settings` under `topics:<repo>` (the repo's `.littlebrother.json`), when uploaded. */
/** Topic named in free text: the most specific segment of a topic key (e.g. "cors" in api.cors) as a word. */
export async function topicFromText(ctx: QueryCtx, repo: string, text: string): Promise<string | undefined> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", `topics:${repo}`))
    .first();
  const parsed = TopicMap.safeParse(row?.value);
  if (!parsed.success) return undefined;
  const words = new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  return Object.keys(parsed.data.topics).find((key) => {
    const last = key.split(".").pop()?.toLowerCase();
    return !!last && words.has(last);
  });
}

/** Topics this change consumes (topic map `consumers`), so the classifier can pair it with changes to them. */
export async function consumesFor(
  ctx: QueryCtx,
  repo: string,
  files: string[],
): Promise<string[] | undefined> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", `topics:${repo}`))
    .first();
  const parsed = TopicMap.safeParse(row?.value);
  if (!parsed.success || files.length === 0) return undefined;
  const topics = consumedTopics(parsed.data, files);
  return topics.length ? topics : undefined;
}

export async function topicFor(ctx: QueryCtx, repo: string, files: string[]): Promise<string | undefined> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", `topics:${repo}`))
    .first();
  const parsed = TopicMap.safeParse(row?.value);
  if (!parsed.success) return undefined;
  for (const [topic, def] of Object.entries(parsed.data.topics)) {
    const patterns = def.files.map(globToRegExp);
    if (files.some((f) => patterns.some((p) => p.test(f)))) return topic;
  }
  return undefined;
}

/**
 * Same normalized command, or the same change (files, ops and edit content), hash identically so retries are
 * exact repeats. Content matters: two different edits to one file must not count as a repeat.
 */
export function actionSignature(env: IngestEnvelope): Promise<string> {
  if (env.command) return sha1Hex(normalizeCommand(env.command));
  const parts = env.touches.length
    ? env.touches.map((t) => `${t.path}:${t.op}`)
    : env.files.map((f) => `${f}:${env.tool ?? "?"}`);
  const content = (env.preview ?? "").replace(/\s+/g, " ").trim();
  return sha1Hex(`${[...parts].sort().join("|")}#${content}`);
}

export function actionTarget(env: IngestEnvelope): string {
  const target = env.command ?? env.files.join(" ");
  return target.length > 120 ? `${target.slice(0, 119)}…` : target;
}

export async function latestActions(ctx: QueryCtx, agentId: Id<"agents">, limit = 30) {
  const recent = await ctx.db
    .query("nodes")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .order("desc")
    .take(limit);
  return recent.filter((n) => n.kind === "action");
}
