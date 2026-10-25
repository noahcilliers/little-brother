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

const norm = (s: string) => s.trim().toLowerCase().replace(/^@/, "");

/**
 * Whether a topic map's `owner` names this member. Teams write the names they use ("noah"), while members are
 * GitHub handles ("noahcilliers"); exact-only matching meant no ownership rule ever fired. Accepts the exact
 * handle, a leading @, the member's name or first name, or a handle prefix of 3+ letters.
 */
export function ownerMatches(owner: string, member: { handle: string; name?: string }): boolean {
  const o = norm(owner);
  const handle = norm(member.handle);
  if (!o) return false;
  if (o === handle) return true;
  const name = norm(member.name ?? "");
  if (name && (o === name || o === name.split(/\s+/)[0])) return true;
  return o.length >= 3 && handle.startsWith(o);
}
