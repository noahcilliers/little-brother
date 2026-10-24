import { type Counterpart, contractCard } from "@lb/core";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// Lookups persist.ts needs per judgment: who the other side is, what a catch against it would spare, and
// whether this pair of goals already has an open alert.

export async function counterpartOf(ctx: QueryCtx, node: Doc<"nodes">): Promise<Counterpart> {
  const agent = await ctx.db.get(node.agentId);
  const member = agent ? await ctx.db.get(agent.memberId) : null;
  const card = node.kind === "action" ? contractCard(node) : "";
  return {
    name: member?.handle ?? "another agent",
    active: agent?.status === "active",
    text: node.text,
    ...(card ? { card } : {}),
  };
}

/** Tokens a catch against `other` would spare: its task's spend, or the failed attempt behind a lesson. */
export async function avoidedTokens(ctx: QueryCtx, other: Doc<"nodes">): Promise<number | undefined> {
  if (other.kind === "knowledge" && other.parentId) return (await ctx.db.get(other.parentId))?.tokens;
  if (other.taskId) return (await ctx.db.get(other.taskId))?.tokens ?? other.tokens;
  return other.tokens;
}

/** The open alert already raised for this pair of goals, if any (its type may differ: rule vs judge wording). */
export async function openCatch(ctx: QueryCtx, key: string): Promise<Doc<"classifications"> | undefined> {
  const rows = await ctx.db
    .query("classifications")
    .withIndex("by_catch", (q) => q.eq("catchKey", key))
    .order("desc")
    .take(20);
  return rows.find((r) => r.status === "open" && r.type !== "normal");
}
