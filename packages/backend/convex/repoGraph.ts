import {
  graphKeysFor,
  type ImporterLink,
  INTERFACE_OPS,
  type IngestEnvelope,
  type Op,
  RepoGraph,
} from "@lb/core";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";

const DROP_BATCH = 2000;
const MAX_CHANGED = 10;
const MAX_FILES_PER_LINK = 50;
type Meta = { hash: string; gen: string; head: string; keys: number; at: number };

const metaKey = (repo: string): string => `graph:${repo}`;

async function metaRow(ctx: QueryCtx, repo: string) {
  return ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", metaKey(repo)))
    .first();
}

async function liveMeta(ctx: QueryCtx, repo: string): Promise<Meta | null> {
  const value: unknown = (await metaRow(ctx, repo))?.value;
  if (typeof value !== "object" || value === null) return null;
  const m = value as Partial<Meta>;
  return typeof m.gen === "string" && typeof m.hash === "string" ? (m as Meta) : null;
}

/** SessionStart hands the graph over; rows are rewritten in a scheduled mutation, and only when it changed. */
export async function queueRepoGraph(ctx: MutationCtx, repo: string, graph: RepoGraph): Promise<void> {
  if ((await liveMeta(ctx, repo))?.hash === graph.hash) return;
  await ctx.scheduler.runAfter(0, internal.repoGraph.store, { repo, graph });
}

/** The ingest log keeps the envelope; the graph is stored once, in its own table, not in every event. */
export function loggedEnvelope(env: IngestEnvelope): Omit<IngestEnvelope, "repoGraph"> {
  const { repoGraph: _graph, ...rest } = env;
  return rest;
}

/**
 * Writes a new generation, then points `graph:<repo>` at it and drops the old one in batches. Each store
 * gets a fresh generation id, so a cleanup still running can never eat rows that became live again.
 */
export const store = internalMutation({
  args: { repo: v.string(), graph: v.any() },
  handler: async (ctx, args) => {
    const graph = RepoGraph.parse(args.graph);
    const live = await liveMeta(ctx, args.repo);
    if (live?.hash === graph.hash) return;
    const gen = `${graph.hash}:${Date.now()}`;
    for (const [key, ids] of graph.edges) {
      const files = ids.map((i) => graph.files[i]).filter((f): f is string => f !== undefined);
      await ctx.db.insert("repoImports", { repo: args.repo, gen, key, files });
    }
    const value: Meta = { hash: graph.hash, gen, head: graph.head, keys: graph.edges.length, at: Date.now() };
    const row = await metaRow(ctx, args.repo);
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("settings", { key: metaKey(args.repo), value });
    if (live) await ctx.scheduler.runAfter(0, internal.repoGraph.dropGen, { repo: args.repo, gen: live.gen });
  },
});

export const dropGen = internalMutation({
  args: { repo: v.string(), gen: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("repoImports")
      .withIndex("by_repo_gen_key", (q) => q.eq("repo", args.repo).eq("gen", args.gen))
      .take(DROP_BATCH);
    for (const r of rows) await ctx.db.delete(r._id);
    if (rows.length === DROP_BATCH) await ctx.scheduler.runAfter(0, internal.repoGraph.dropGen, args);
  },
});

type TouchLike = { path: string; symbol?: string; op: string };

/**
 * Importers of every symbol whose interface these touches change: point reads on the precomputed graph, run
 * once when the node is stored so classification never touches the graph. A file-level delete or rename
 * reads every key of that file (an index range).
 */
export async function importersFor(
  ctx: QueryCtx,
  repo: string,
  touches: TouchLike[],
): Promise<ImporterLink[] | undefined> {
  const changed = touches.filter((t) => INTERFACE_OPS.has(t.op as Op)).slice(0, MAX_CHANGED);
  if (changed.length === 0) return undefined;
  const live = await liveMeta(ctx, repo);
  if (!live) return undefined;
  const byLink = new Map<string, ImporterLink>();
  const add = (symbol: string, via: ImporterLink["via"], files: string[], own: string): void => {
    const link = byLink.get(`${via}|${symbol}`) ?? { symbol, via, files: [] };
    for (const f of files) if (f !== own && !link.files.includes(f)) link.files.push(f);
    byLink.set(`${via}|${symbol}`, link);
  };
  const rows = (lo: string, hi?: string) =>
    ctx.db.query("repoImports").withIndex("by_repo_gen_key", (q) => {
      const base = q.eq("repo", repo).eq("gen", live.gen);
      return hi === undefined ? base.eq("key", lo) : base.gte("key", lo).lt("key", hi);
    });
  for (const t of changed) {
    if (t.symbol) {
      for (const { key, via } of graphKeysFor(t.symbol)) {
        const row = await rows(key).first();
        if (row) add(t.symbol, via, row.files, t.path);
      }
    } else {
      for (const row of await rows(`${t.path}::`, `${t.path}::￿`).take(MAX_FILES_PER_LINK))
        add(t.path, "symbol", row.files, t.path);
    }
  }
  const links = [...byLink.values()];
  // A file importing the symbol by name is already the stronger link; don't repeat it as a module importer.
  for (const l of links.filter((x) => x.via === "module")) {
    const named = new Set(byLink.get(`symbol|${l.symbol}`)?.files ?? []);
    l.files = l.files.filter((f) => !named.has(f));
  }
  const out = links
    .filter((l) => l.files.length > 0)
    .map((l) => ({ ...l, files: l.files.slice(0, MAX_FILES_PER_LINK) }));
  return out.length ? out : undefined;
}
