import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Klass = Doc<"classifications">;

export type Settlement = {
  status: "resolved" | "dismissed";
  resolution: string;
  /** Shown on the board: "ash on the dashboard", "@noah (owner)", "noah's push". */
  by: string;
  outcome?: string;
  feedback?: Klass["feedback"];
  /** The agent the Resolve event is filed under (the board reads settle times from it). */
  agentId: Id<"agents">;
  summary: string;
  files?: string[];
  nodeId?: Id<"nodes">;
  source?: Doc<"events">["source"];
};

/** Close a catch and record who settled it and when, so the board flips it to settled the moment it happens. */
export async function settleCatch(ctx: MutationCtx, c: Klass, s: Settlement): Promise<void> {
  const now = Date.now();
  await ctx.db.patch(c._id, {
    status: s.status,
    resolution: s.resolution,
    resolvedBy: s.by,
    resolvedAt: now,
    ...(s.outcome ? { outcome: s.outcome } : {}),
    ...(s.feedback ? { feedback: s.feedback } : {}),
  });
  await ctx.db.insert("events", {
    agentId: s.agentId,
    eventKey: `resolve:${c._id}`,
    source: s.source ?? "human",
    hook: "Resolve",
    files: s.files ?? [],
    summary: s.summary,
    payload: { classificationId: c._id, by: s.by, status: s.status },
    ...(s.nodeId ? { nodeId: s.nodeId } : {}),
    at: now,
  });
}

/** Tell an agent how its catch was settled; it arrives with its next hook or over the channel. */
export async function notify(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  classificationId: Id<"classifications">,
  text: string,
  action: Doc<"inbox">["action"] = "warn",
): Promise<void> {
  await ctx.db.insert("inbox", {
    agentId,
    classificationId,
    text: text.startsWith("[little-brother]") ? text : `[little-brother] ${text}`,
    action,
    state: "queued",
    attempts: 0,
    at: Date.now(),
  });
}

/**
 * A catch a person (or the owner, or a landed push) already settled. Later steps of the same two goals map to it
 * and stay quiet: otherwise every retry after a dashboard decision would be caught and denied all over again.
 */
export async function settledCatch(ctx: QueryCtx, key: string): Promise<Klass | undefined> {
  const rows = await ctx.db
    .query("classifications")
    .withIndex("by_catch", (q) => q.eq("catchKey", key))
    .order("desc")
    .take(20);
  return rows.find((r) => r.status !== "open" && r.type !== "normal" && r.resolvedAt !== undefined);
}
