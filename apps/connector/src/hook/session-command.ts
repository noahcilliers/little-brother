import { context, type HookInput, type HookOutput, sessionCommand } from "@lb/core";
import { z } from "zod";
import { activeProfile } from "../config";
import { HttpError, postJson } from "../http";
import { clearAttachment, readAttachment, writeAttachment } from "./attach";

const Attached = z.object({
  status: z.enum(["joined", "pending", "denied"]).default("joined"),
  code: z.string(),
  name: z.string(),
  room: z.string(),
});
type Attached = z.infer<typeof Attached>;
const say = (text: string): HookOutput => context("UserPromptSubmit", `[little-brother] ${text}`);

export type SessionCommandResult = { output: HookOutput; joined?: string; left?: string };

type AttachOutcome =
  | { kind: "ok"; res: Attached }
  | { kind: "unknown" }
  | { kind: "offline" }
  | { kind: "unjoined" };

const parseOr = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** POST /session/attach. 202 (waiting room) parses like 200; 403 (denied) carries the session in its body. */
async function attach(code: string, as?: string): Promise<AttachOutcome> {
  const profile = activeProfile(as);
  if (!profile) return { kind: "unjoined" };
  try {
    const body = await postJson(
      `${profile.siteUrl}/session/attach`,
      { code },
      { token: profile.token, timeoutMs: 4000 },
    );
    return { kind: "ok", res: Attached.parse(body) };
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return { kind: "unknown" };
    if (e instanceof HttpError && e.status === 403) {
      const parsed = Attached.safeParse(parseOr(e.body));
      if (parsed.success) return { kind: "ok", res: parsed.data };
    }
    return { kind: "offline" };
  }
}

function joinedText(res: Attached, admitted: boolean): string {
  const lead = admitted
    ? `The host admitted you: this Claude session is now in`
    : `This Claude session joined`;
  return `${lead} "${res.name}" in room ${res.room} (code ${res.code}). Teammates' Claude sessions in it now see your work and you see theirs.`;
}

/**
 * `/little-brother:join <code>` and `/little-brother:leave`, answered from the prompt hook (the only place
 * that knows this Claude session's id). Returns null for every other prompt.
 */
export async function handleSessionCommand(
  input: HookInput,
  as?: string,
): Promise<SessionCommandResult | null> {
  if (input.hook_event_name !== "UserPromptSubmit") return null;
  const cmd = sessionCommand(input.prompt);
  if (!cmd) return null;
  if (cmd.kind === "leave") {
    const was = readAttachment(input.session_id);
    clearAttachment(input.session_id);
    const text = was
      ? `This Claude session left "${was.name}". Nothing from it is shared any more. Tell the user in one line.`
      : "This Claude session was not in a Little Brother session. Tell the user in one line.";
    return { output: say(text), left: was && !was.pending ? was.code : undefined };
  }
  const out = await attach(cmd.code, as);
  if (out.kind === "unjoined")
    return {
      output: say("This laptop is not connected yet. Tell the user to run the install line from /start."),
    };
  if (out.kind === "unknown")
    return {
      output: say(`No open session with code ${cmd.code}. Tell the user to check the code on the dashboard.`),
    };
  if (out.kind === "offline")
    return {
      output: say("Little Brother is unreachable right now; nothing was joined. Tell the user in one line."),
    };
  const { res } = out;
  if (res.status === "denied") {
    clearAttachment(input.session_id);
    return { output: say(`The host of room ${res.room} declined this request. Tell the user in one line.`) };
  }
  if (res.status === "pending") {
    writeAttachment(input.session_id, { code: res.code, name: res.name, room: res.room, pending: true });
    return {
      output: say(
        `Asked the host of room ${res.room} to let this session into "${res.name}". Nothing is shared until they admit it; after that it joins on the next prompt by itself. Tell the user in one line, then carry on with their work.`,
      ),
    };
  }
  writeAttachment(input.session_id, { code: res.code, name: res.name, room: res.room });
  return {
    output: say(`${joinedText(res, false)} Confirm to the user in one line, then wait for their task.`),
    joined: res.code,
  };
}

/**
 * A session in the waiting room asks again on each prompt. Returns the code once admitted (plus a line for
 * the agent), or null while it still waits or was declined.
 */
export async function retryPending(
  input: HookInput,
  as?: string,
): Promise<{ code: string; note: string } | null> {
  if (input.hook_event_name !== "UserPromptSubmit") return null;
  const a = readAttachment(input.session_id);
  if (!a?.pending) return null;
  const out = await attach(a.code, as);
  if (out.kind === "unknown" || (out.kind === "ok" && out.res.status === "denied"))
    clearAttachment(input.session_id);
  if (out.kind !== "ok" || out.res.status !== "joined") return null;
  writeAttachment(input.session_id, { code: out.res.code, name: out.res.name, room: out.res.room });
  return { code: out.res.code, note: `[little-brother] ${joinedText(out.res, true)}` };
}
