import type { Doc, Id } from "./_generated/dataModel";
import { EXTRA_ORDERING, LOOSE } from "./devSeedExtra";
import { BRANCH } from "./devSeedStory";
import { memberFor, REPO, type Story, TAG, writeNode } from "./devSeedWrite";
import { demoSession } from "./migrateRooms";

// Dev only: the remaining devSeed rows (verdicts, loose reads, the ordering catch, the verify run).

type Verdict = Pick<
  Doc<"classifications">,
  | "nodeId"
  | "againstNodeId"
  | "type"
  | "relation"
  | "action"
  | "agentIds"
  | "reason"
  | "status"
  | "comparison"
>;

export function writeVerdict(s: Story, t: number, v: Verdict) {
  return s.ctx.db.insert("classifications", {
    ...v,
    direction: "new_needs_other",
    evidence: [],
    confidence: 0.9,
    retrievalScore: 0.9,
    source: "rule",
    latencyMs: 40,
    at: s.T(t),
  });
}

/** Reads outside any task: routine ticks on the row between bars. */
export async function writeLoose(s: Story) {
  for (const r of LOOSE) {
    if (!s.seen(r.t) || !s.handles.includes(r.a)) continue;
    const nodeId = await writeNode(s, r.a, r.t, { kind: "action", text: `EXPLORE ${r.target}` });
    await s.ctx.db.patch(nodeId, { files: [r.target], label: `read ${r.target.split("/").pop()}` });
  }
}

/** With the extra teammates: sam's step waits for joshua's checkout work (an ordering catch). */
export async function writeOrdering(s: Story, firstAct: Map<string, Id<"nodes">>) {
  const nodeId = firstAct.get(EXTRA_ORDERING.from);
  const againstNodeId = firstAct.get(EXTRA_ORDERING.against);
  if (!nodeId || !againstNodeId || !s.seen(EXTRA_ORDERING.t)) return;
  await writeVerdict(s, EXTRA_ORDERING.t, {
    nodeId,
    againstNodeId,
    type: "conflict",
    relation: "ordering_dependency",
    action: "serialize",
    agentIds: [s.agent.sam, s.agent.joshua],
    reason: "[little-brother] conflict · sendOrderEmail() needs the checkout routes to land first.",
    status: "open",
  });
}

export async function writeVerify(s: Story, t: number) {
  const scope = await demoSession(s.ctx);
  const verifier = await s.ctx.db.insert("agents", {
    teamId: scope.teamId,
    sessionId: scope._id,
    memberId: await memberFor(s.ctx, "noah"),
    claudeSessionId: `${TAG}-verify-${s.now}`,
    machine: "verify",
    repo: REPO,
    branch: "main",
    status: "offline",
    lastSeenAt: s.now,
  });
  await s.ctx.db.insert("events", {
    agentId: verifier,
    eventKey: `${TAG}:${s.now}:verify`,
    source: "verify",
    hook: "verify",
    files: [],
    summary: "verify: tests passed, 0 merge conflict(s)",
    payload: { branches: Object.values(BRANCH), passed: true, outputTail: "14 passed", conflicts: [] },
    at: s.T(t),
  });
}

/** A topic map for the demo repo, so a decision names its owner. Left alone if the repo already has one. */
export async function writeTopicMap(s: Story) {
  const key = `topics:${REPO}`;
  const have = await s.ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (have) return;
  const topics = {
    "auth.mechanism": { owner: "noah", files: ["src/auth/**"], consumers: ["src/checkout/**"] },
    "db.users": { owner: "noah", files: ["db/schema/users.ts"], consumers: [] },
    "api.cors": { owner: "noah", files: ["src/server.ts"], consumers: [] },
  };
  await s.ctx.db.insert("settings", { key, value: { topics, [TAG]: true } });
}
