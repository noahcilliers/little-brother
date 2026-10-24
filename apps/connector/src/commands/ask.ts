import { AskInput, askReply, deny } from "@lb/core";
import { z } from "zod";
import { activeProfile } from "../config";
import { sessionCodeFor } from "../hook/attach";
import { postJson } from "../http";

// PreToolUse for AskUserQuestion: route the question to the dashboard when the developer has the session open,
// wait for their answer, and return it as the denial reason. Any failure or timeout exits 0 with no output, so
// Claude Code asks in the terminal as usual (fail open).

const HookIn = z.object({
  session_id: z.string(),
  tool_use_id: z.string().optional(),
  tool_input: z.unknown(),
});
const Created = z.object({ id: z.string().nullable() });
const Status = z.object({
  status: z.enum(["pending", "answered", "expired"]).optional(),
  answers: z
    .array(z.object({ question: z.string(), selected: z.array(z.string()), other: z.string().optional() }))
    .optional(),
});

const POLL_MS = 1500;
// Below the plugin's 600 s hook timeout, leaving time to hand the question back to the terminal.
const WAIT_MS = Number(process.env.LB_ASK_TIMEOUT_MS ?? 540_000);

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function askCommand(): Promise<void> {
  try {
    const input = HookIn.parse(JSON.parse(await readStdin()));
    const questions = AskInput.parse(input.tool_input).questions;
    const profile = activeProfile();
    if (!profile || !sessionCodeFor(input.session_id)) return;
    const post = (op: string, body: unknown) =>
      postJson(`${profile.siteUrl}/ask/${op}`, body, { token: profile.token, timeoutMs: 5000 });
    const { id } = Created.parse(
      await post("create", { claudeSessionId: input.session_id, toolUseId: input.tool_use_id, questions }),
    );
    if (!id) return;
    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_MS);
      const s = Status.parse(await post("status", { id }).catch(() => ({})));
      if (s.status === "answered" && s.answers) {
        process.stdout.write(JSON.stringify(deny(askReply(s.answers))));
        return;
      }
      if (s.status === "expired") return;
    }
    await post("expire", { id }).catch(() => undefined);
  } catch {
    // fail open: the terminal asks
  }
}
