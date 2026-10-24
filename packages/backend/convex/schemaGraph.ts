import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Repo graph link stored on a node: files importing a symbol whose interface the node changes. */
export const importerLink = v.object({
  symbol: v.string(),
  files: v.array(v.string()),
  via: v.union(v.literal("symbol"), v.literal("module")),
});

/**
 * The latest repo import graph, one row per key (`file::name` or `file::*`), so a lookup is a point read
 * on the index. `gen` is the graph's content hash; `settings` `graph:<repo>` names the live generation.
 */
export const graphTables = {
  repoImports: defineTable({
    repo: v.string(),
    gen: v.string(),
    key: v.string(),
    files: v.array(v.string()),
  }).index("by_repo_gen_key", ["repo", "gen", "key"]),
};
