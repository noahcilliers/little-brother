import type { IngestEnvelope } from "@lb/core";
import { cachedGraph, startBackgroundGraphBuild } from "../graph/cache";
import { loadTopicMap } from "../normalize/topic-map";
import type { RepoInfo } from "./git";
import { headSha } from "./git-state";

/**
 * SessionStart carries the repo's context: the topic map, and the import graph when one is cached for this
 * HEAD. A miss sends nothing and (from the real hook only) starts a detached build for next time.
 */
export function addSessionContext(envelope: IngestEnvelope, repo: RepoInfo, background: boolean): void {
  envelope.topicMap = loadTopicMap(repo.root);
  try {
    const head = headSha(repo);
    if (!head) return;
    const graph = cachedGraph(repo.root, head);
    if (graph) envelope.repoGraph = graph;
    else if (background) startBackgroundGraphBuild(repo.root, head);
  } catch {
    // the graph is an enrichment; SessionStart goes out without it
  }
}

/** On Stop, a moved HEAD (commit, checkout, pull) gets its graph built before the next SessionStart. */
export function refreshGraphInBackground(repo: RepoInfo): void {
  try {
    const head = headSha(repo);
    if (head && !cachedGraph(repo.root, head)) startBackgroundGraphBuild(repo.root, head);
  } catch {
    // best effort
  }
}
