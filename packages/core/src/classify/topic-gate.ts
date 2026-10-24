import type { TopicMap } from "../topics";
import { isMutation } from "./touches";
import type { ClassifiedNode, Judgment, Relation } from "./types";

/** An open blocking classification, flattened with what the gate needs to know about it. */
export type OpenConflict = {
  classificationId: string;
  relation: Relation;
  confidence: number;
  topics: string[]; // topics of the two nodes involved
  agentIds: string[];
  /** For each involved agent, the node on the *other* side (what this agent collides with). */
  otherNodeFor: Record<string, string>;
  reason: string;
};

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped
    .replace(/\*\*\/?/g, "§DEEP§")
    .replace(/\*/g, "[^/]*")
    .replaceAll("§DEEP§", ".*");
  return new RegExp(`^${pattern}$`);
}

/** A file belongs to a topic if it is one of the topic's files or one of its consumers. */
export function topicCovers(map: TopicMap, topic: string, path: string): boolean {
  const def = map.topics[topic];
  if (!def) return false;
  return [...def.files, ...def.consumers].some((g) => globToRegExp(g).test(path));
}

/** Topics that these paths consume (match a topic's consumers globs, not its own files). */
export function consumedTopics(map: TopicMap, paths: string[]): string[] {
  return Object.entries(map.topics)
    .filter(([, def]) => {
      const globs = def.consumers.map(globToRegExp);
      return paths.some((p) => globs.some((g) => g.test(p)));
    })
    .map(([topic]) => topic);
}

/** The topic whose own files (consumers excluded) include one of these paths: who owns this code. */
export function topicOfPaths(map: TopicMap, paths: string[]): string | undefined {
  for (const [topic, def] of Object.entries(map.topics)) {
    const globs = def.files.map(globToRegExp);
    if (paths.some((p) => globs.some((g) => g.test(p)))) return topic;
  }
  return undefined;
}

/**
 * While a blocking conflict on a topic is open, the non-owner side may not mutate that topic's files or
 * consumers: pairwise rules alone would let it keep building on the losing approach. The owner keeps
 * working; the gate lifts when a human resolves or dismisses the conflict.
 */
export function topicGate(
  next: ClassifiedNode,
  open: OpenConflict[],
  map: TopicMap,
  handleOf: (agentId: string) => string | undefined,
): Judgment[] {
  if (next.kind !== "action") return [];
  const paths = next.touches.filter((t) => isMutation(t) && !t.generated).map((t) => t.path);
  if (paths.length === 0) return [];
  const handle = handleOf(next.agentId);
  const out: Judgment[] = [];
  for (const c of open) {
    const otherNodeId = c.otherNodeFor[next.agentId];
    if (!otherNodeId) continue;
    for (const topic of c.topics) {
      const owner = map.topics[topic]?.owner;
      if (owner && owner === handle) continue;
      const hit = paths.find((p) => topicCovers(map, topic, p));
      if (!hit) continue;
      out.push({
        otherNodeId,
        relation: c.relation,
        direction: "new_needs_other",
        confidence: c.confidence,
        evidence: [
          `${topic} conflict open${owner ? `, owner ${owner} decides` : ""}; ${hit} is on that topic`,
          c.reason.replace(/^\[little-brother\] \w+ · /, ""),
        ],
        action: "block",
        source: "rule",
        retrievalScore: 1,
        latencyMs: 0,
        type: "conflict",
      });
      break;
    }
  }
  return out;
}
