import type { Doc } from "../_generated/dataModel";
import { type Ctx, handleCache, type Klass, verdictsForNode, worstVerdict } from "./shared";

const RECENT_VERDICTS = 2000;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/**
 * Verify rows come from `lb verify` (foreground) or the background merge-tree check. The payload is
 * stored as-is, so read it defensively: older rows and the background runner may omit fields.
 */
export function verifyView(e: Doc<"events">) {
  if (e.source !== "verify") return undefined;
  const p: Record<string, unknown> = isRecord(e.payload) ? e.payload : {};
  const branches = Array.isArray(p.branches) ? p.branches.filter((b) => typeof b === "string") : [];
  const conflicts = Array.isArray(p.conflicts) ? p.conflicts.length : 0;
  const background =
    p.background === true || p.mode === "background" || p.trigger === "background" || e.hook !== "verify";
  return {
    background,
    branches,
    conflicts,
    passed: typeof p.passed === "boolean" ? p.passed : undefined,
  };
}

export async function activity(ctx: Ctx, limit: number | undefined) {
  const events = await ctx.db
    .query("events")
    .withIndex("by_time")
    .order("desc")
    .take(Math.min(limit ?? 50, 200));
  const handle = handleCache(ctx);
  return Promise.all(
    events.map(async (e) => {
      const node = e.nodeId ? await ctx.db.get(e.nodeId) : null;
      const verdict = e.nodeId ? worstVerdict(await verdictsForNode(ctx, e.nodeId)) : undefined;
      return {
        _id: e._id,
        at: e.at,
        hook: e.hook,
        tool: e.tool,
        source: e.source,
        handle: await handle(e.agentId),
        signature: node?.text ?? e.summary,
        type: verdict?.type ?? "normal",
        action: verdict?.action,
        relation: verdict?.relation,
        gitStatus: verdict?.gitStatus,
        takeover: verdict?.winnerAgentId !== undefined && verdict.winnerAgentId === node?.agentId,
        verify: verifyView(e),
      };
    }),
  );
}

export async function eventTypeCounts(ctx: Ctx) {
  const types = await ctx.db.query("eventTypes").take(20);
  const all = await ctx.db.query("classifications").order("desc").take(RECENT_VERDICTS);
  const count = (key: Klass["type"], pred: (c: Klass) => boolean = () => true) =>
    all.filter((c) => c.type === key && pred(c)).length;
  const keys = ["conflict", "duplicate", "stale", "normal"] as const;
  return keys.map((key) => {
    const row = types.find((t) => t.key === key);
    return {
      key,
      enforcement: row?.enforcement ?? (key === "normal" ? "silent" : key === "stale" ? "warn" : "block"),
      description: row?.description ?? "",
      total: count(key),
      open: count(key, (c) => c.status === "open"),
      dismissed: count(key, (c) => c.status === "dismissed"),
    };
  });
}
