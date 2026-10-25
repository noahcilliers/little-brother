import { parseArgs } from "node:util";

export type PublishOptions = {
  results: string[];
  replay: string | null;
  classifier: string | null;
  latencyMd: string | null;
  snapshot: string | null;
  push: boolean;
  prod: boolean;
};

export const PUBLISH_USAGE = `usage: pnpm --filter @lb/evals publish-results -- [options]
  --results dir      results dir, or a parent of suite dirs (repeatable)
  --replay key       runKey to feature on the landing (default: best caught-and-merged on run)
  --classifier file  pair model report, e.g. scripts/classifier/results/2026-10-24-v2.json
  --latency-md file  markdown with the replay latency table, e.g. scripts/classifier/results/2026-10-24-real.md
  --snapshot file    also write the landing's fallback JSON here
  --push             send to Convex with \`npx convex run\` (without it: dry run, prints counts)
  --prod             with --push: target the production deployment`;

/** Parses argv; dry run unless --push, so a stray invocation never writes to a deployment. */
export function parsePublishOptions(argv: string[]): PublishOptions {
  const { values } = parseArgs({
    args: argv.filter((a) => a !== "--"),
    options: {
      results: { type: "string", multiple: true },
      replay: { type: "string" },
      classifier: { type: "string" },
      "latency-md": { type: "string" },
      snapshot: { type: "string" },
      push: { type: "boolean", default: false },
      prod: { type: "boolean", default: false },
    },
    strict: true,
  });
  return {
    results: values.results ?? [],
    replay: values.replay ?? null,
    classifier: values.classifier ?? null,
    latencyMd: values["latency-md"] ?? null,
    snapshot: values.snapshot ?? null,
    push: values.push ?? false,
    prod: values.prod ?? false,
  };
}
