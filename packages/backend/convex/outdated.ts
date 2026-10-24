import { context, type HookOutput, type IngestEnvelope, sessionCommand } from "@lb/core";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { logForMember, loggedRecently } from "./serverLog";

// Convex injects env vars at runtime; the convex tsconfig deliberately omits node types.
declare const process: { env: Record<string, string | undefined> };

const WARN_EVERY_MS = 10 * 60_000;

const updateLine = () => {
  const site = process.env.SITE_URL;
  return site ? `curl -fsSL ${site}/install.sh | sh` : "the install line from the site's /start page";
};

/**
 * An event with no usable session. A current connector never sends one unless its session ended or it was
 * removed; an outdated connector (from before sessions) sends every event like this and cannot join, so the
 * join attempt gets told how to update instead of silence, and the host's log says why nothing arrives.
 */
export async function unscoped(
  ctx: MutationCtx,
  member: Doc<"members">,
  hook: string,
  env: IngestEnvelope,
): Promise<HookOutput> {
  const outdated = env.session.lbSession === undefined;
  const kind = outdated ? "outdated-connector" : "not-in-session";
  if (!(await loggedRecently(ctx, member._id, kind, WARN_EVERY_MS)))
    await logForMember(ctx, member._id, {
      level: "warn",
      kind,
      text: outdated
        ? `@${member.handle}'s connector on ${env.session.machine} is outdated; its events are dropped until it updates`
        : `@${member.handle} sent events for session ${env.session.lbSession}, which is ended or not theirs`,
    });
  const asked = hook === "UserPromptSubmit" && env.prompt ? sessionCommand(env.prompt) : null;
  // A current connector still attached to an ended session (or a room it left): say so once per prompt, so the
  // agent can ask for a new code instead of every event vanishing silently.
  if (!outdated && hook === "UserPromptSubmit")
    return context(
      "UserPromptSubmit",
      `[little-brother] Session ${env.session.lbSession} has ended, or you're no longer in its room, so nothing from this Claude session is shared. Tell the user in one line and ask for a new code to run /little-brother:join <code> (or /little-brother:leave).`,
    );
  if (!outdated || !asked) return null;
  return context(
    "UserPromptSubmit",
    `[little-brother] This laptop's Little Brother connector is out of date and can't join sessions. Tell the user to run \`${updateLine()}\` in a terminal, then run /little-brother:join again.`,
  );
}
