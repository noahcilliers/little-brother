import { z } from "zod";

/** `.littlebrother.json` committed in each repo: optional topic map + verify command. */
export const TopicMap = z.object({
  topics: z
    .record(
      z.object({ owner: z.string(), files: z.array(z.string()), consumers: z.array(z.string()).default([]) }),
    )
    .default({}),
  generated: z.array(z.string()).default(["**/package-lock.json", "**/pnpm-lock.yaml", "**/dist/**"]),
  verify: z.string().optional(),
});
export type TopicMap = z.infer<typeof TopicMap>;
