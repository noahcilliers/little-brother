import { z } from "zod";
import type { ActiveProfile } from "../config";
import { readSessionId } from "../hook/session-file";

const WatchItem = z.object({
  id: z.string(),
  text: z.string(),
  action: z.string().optional(),
  kind: z.string().optional(),
});
const WatchResult = z.array(WatchItem);
export type ChannelPush = { content: string; meta: { item_id: string; kind: string } };

const SESSION_POLL_MS = 3000;

/** meta values reach Claude as tag attributes, so the free-form kind is kept to a safe charset. */
const safe = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, "_");

/**
 * Subscribes to the backend's per-session inbox and forwards each new item as a channel push.
 * The session id is re-read because SessionStart may write it after this server has started.
 */
export async function startChannel(
  profile: ActiveProfile,
  push: (p: ChannelPush) => Promise<void>,
): Promise<() => void> {
  const [{ ConvexClient }, { makeFunctionReference }] = await Promise.all([
    import("convex/browser"),
    import("convex/server"),
  ]);
  // By string name: the backend's generated api types are not a dependency of the connector.
  const watch = makeFunctionReference<"query">("inbox:watch");
  const markDelivered = makeFunctionReference<"mutation">("inbox:markDelivered");
  // Convex logs with console.log by default, which would corrupt the stdio JSON-RPC stream.
  const toStderr = (...args: unknown[]): void =>
    void process.stderr.write(`lb mcp: ${args.map(String).join(" ")}\n`);
  const client = new ConvexClient(profile.convexUrl, {
    logger: { log: () => undefined, logVerbose: () => undefined, warn: toStderr, error: toStderr },
  });
  const seen = new Set<string>();
  let sessionId = readSessionId();
  let unsubscribe: (() => void) | null = null;

  const onItems = async (raw: unknown): Promise<void> => {
    const parsed = WatchResult.safeParse(raw);
    if (!parsed.success) return;
    const fresh = parsed.data.filter((i) => !seen.has(i.id));
    if (fresh.length === 0) return;
    for (const i of fresh) seen.add(i.id);
    const delivered: string[] = [];
    for (const i of fresh) {
      try {
        await push({ content: i.text, meta: { item_id: i.id, kind: safe(i.kind ?? i.action ?? "notice") } });
        delivered.push(i.id);
      } catch {
        seen.delete(i.id);
      }
    }
    if (delivered.length) {
      await client.mutation(markDelivered, { token: profile.token, ids: delivered }).catch(() => undefined);
    }
  };

  const subscribe = (): void => {
    unsubscribe?.();
    unsubscribe = client.onUpdate(
      watch,
      { token: profile.token, claudeSessionId: sessionId },
      (items) => void onItems(items),
      () => undefined,
    );
  };
  subscribe();

  const timer = setInterval(() => {
    const next = readSessionId();
    if (next !== sessionId) {
      sessionId = next;
      subscribe();
    }
  }, SESSION_POLL_MS);
  timer.unref();

  return () => {
    clearInterval(timer);
    unsubscribe?.();
    void client.close();
  };
}
