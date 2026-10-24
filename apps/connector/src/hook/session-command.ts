import { context, type HookInput, type HookOutput, sessionCommand } from "@lb/core";
import { z } from "zod";
import { activeProfile } from "../config";
import { HttpError, postJson } from "../http";
import { clearAttachment, readAttachment, writeAttachment } from "./attach";

const Attached = z.object({ code: z.string(), name: z.string(), room: z.string() });
const say = (text: string): HookOutput => context("UserPromptSubmit", `[little-brother] ${text}`);

export type SessionCommandResult = { output: HookOutput; joined?: string; left?: string };

/**
 * `/little-brother:join <code>` and `/little-brother:leave`, answered from the prompt hook (the only place
 * that knows this Claude session's id). Returns null for every other prompt.
 */
export async function handleSessionCommand(input: HookInput, as?: string): Promise<SessionCommandResult | null> {
  if (input.hook_event_name !== "UserPromptSubmit") return null;
  const cmd = sessionCommand(input.prompt);
  if (!cmd) return null;
  if (cmd.kind === "leave") {
    const was = readAttachment(input.session_id);
    clearAttachment(input.session_id);
    return {
      output: say(
        was
          ? `This Claude session left "${was.name}". Nothing from it is shared any more. Tell the user in one line.`
          : "This Claude session was not in a Little Brother session. Tell the user in one line.",
      ),
      left: was?.code,
    };
  }
  const profile = activeProfile(as);
  if (!profile)
    return { output: say("This laptop is not connected yet. Tell the user to run the install line from /start.") };
  try {
    const res = Attached.parse(
      await postJson(`${profile.siteUrl}/session/attach`, { code: cmd.code }, { token: profile.token, timeoutMs: 4000 }),
    );
    writeAttachment(input.session_id, res);
    return {
      output: say(
        `This Claude session joined "${res.name}" in room ${res.room} (code ${res.code}). Teammates' Claude sessions in it now see your work and you see theirs. Confirm to the user in one line, then wait for their task.`,
      ),
      joined: res.code,
    };
  } catch (e) {
    const why =
      e instanceof HttpError && e.status === 404
        ? `No open session with code ${cmd.code} in your rooms. Check the code on the dashboard.`
        : "Little Brother is unreachable right now; nothing was joined.";
    return { output: say(`${why} Tell the user in one line.`) };
  }
}
