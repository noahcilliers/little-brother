import { type Priority, TopicMap, topicOfPaths } from "@lb/core";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

const TRAJECTORY_CAP = 200;
const DECISION_SCAN = 50;

type AgentFacts = {
  memberId?: Id<"members">;
  handle?: string;
  repo?: string;
  intentTopic?: string;
  progress: number;
};

export type PriorityLoader = {
  /** Claim strength of the agent that wrote `node`, relative to the node's topic. */
  of(node: Doc<"nodes">): Promise<Priority>;
};

/**
 * Builds priorities with per-call caches (agent facts, topic maps, decision authors), so a sync check costs
 * a handful of indexed reads per distinct agent and topic, not per candidate.
 */
export function priorityLoader(ctx: QueryCtx): PriorityLoader {
  const agents = new Map<string, Promise<AgentFacts>>();
  const maps = new Map<string, Promise<TopicMap | null>>();
  const deciders = new Map<string, Promise<Id<"members"> | undefined>>();

  const mapFor = (repo: string) => {
    let m = maps.get(repo);
    if (!m) {
      m = ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", `topics:${repo}`))
        .first()
        .then((row) => {
          const parsed = TopicMap.safeParse(row?.value);
          return parsed.success ? parsed.data : null;
        });
      maps.set(repo, m);
    }
    return m;
  };

  const factsFor = (agentId: Id<"agents">) => {
    let f = agents.get(agentId);
    if (!f) {
      f = loadFacts(ctx, agentId);
      agents.set(agentId, f);
    }
    return f;
  };

  // The latest standing decision on a topic, by member: a decision posted from an earlier session still counts.
  const deciderOf = (topic: string) => {
    let d = deciders.get(topic);
    if (!d) {
      d = ctx.db
        .query("nodes")
        .withIndex("by_topic", (q) => q.eq("topic", topic))
        .order("desc")
        .take(DECISION_SCAN)
        .then(async (rows) => {
          const latest = rows.find((n) => n.verb === "DECIDE" && n.outcome !== "superseded");
          return latest ? (await factsFor(latest.agentId)).memberId : undefined;
        });
      deciders.set(topic, d);
    }
    return d;
  };

  return {
    async of(node) {
      const facts = await factsFor(node.agentId);
      const map = facts.repo ? await mapFor(facts.repo) : null;
      const paths = node.files.concat(node.touches.map((t) => t.path));
      const topic = node.topic ?? (map ? topicOfPaths(map, paths) : undefined);
      if (!topic) return { owner: false, aligned: false, scopeFit: false, progress: facts.progress };
      const owner = map?.topics[topic]?.owner;
      const decider = await deciderOf(topic);
      return {
        owner: !!owner && owner === facts.handle,
        aligned: !!decider && decider === facts.memberId,
        scopeFit: facts.intentTopic === topic,
        progress: facts.progress,
      };
    },
  };
}

/** Succeeded actions in the current trajectory, a passing test counting double. */
function progressOf(intent: Doc<"nodes">, nodes: Doc<"nodes">[]): number {
  let score = 0;
  for (const n of nodes) {
    if (n.parentId !== intent._id || n.kind !== "action" || n.outcome !== "succeeded") continue;
    score += n.verb === "TEST" ? 2 : 1;
  }
  return score;
}

async function loadFacts(ctx: QueryCtx, agentId: Id<"agents">): Promise<AgentFacts> {
  const agent = await ctx.db.get(agentId);
  if (!agent) return { progress: 0 };
  const member = await ctx.db.get(agent.memberId);
  const intent = agent.intentId ? await ctx.db.get(agent.intentId) : null;
  const base = { memberId: agent.memberId, handle: member?.handle, repo: agent.repo };
  if (!intent) return { ...base, progress: 0 };
  const trajectory = await ctx.db
    .query("nodes")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId).gte("at", intent.at))
    .take(TRAJECTORY_CAP);
  return { ...base, intentTopic: intent.topic, progress: progressOf(intent, trajectory) };
}
