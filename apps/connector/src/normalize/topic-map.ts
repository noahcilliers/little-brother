import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TopicMap } from "@lb/core";
import picomatch from "picomatch";

export function loadTopicMap(repoRoot: string): TopicMap {
  try {
    return TopicMap.parse(JSON.parse(readFileSync(join(repoRoot, ".littlebrother.json"), "utf8")));
  } catch {
    return TopicMap.parse({});
  }
}

export function generatedMatcher(globs: string[]): (path: string) => boolean {
  if (globs.length === 0) return () => false;
  return picomatch(globs, { dot: true });
}
