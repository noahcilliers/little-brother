import type { IngestEnvelope } from "@lb/core";
import { convexTest } from "convex-test";
import { internal } from "../convex/_generated/api";
import { sha256Hex } from "../convex/hash";
import schema from "../convex/schema";

export const modules = import.meta.glob("../convex/**/*.ts");
export const makeT = () => convexTest(schema, modules);
export type T = ReturnType<typeof makeT>;

let seq = 0;
export function envelope(hook: string, session: string, extra: Partial<IngestEnvelope> = {}): IngestEnvelope {
  seq += 1;
  return {
    v: 1,
    eventKey: `${session}|${hook}|${seq}`,
    hook,
    session: {
      claudeSessionId: session,
      repo: "lb-demo-shop",
      branch: `${session}/branch`,
      machine: "mbp",
      cwd: "/x",
    },
    files: [],
    touches: [],
    references: [],
    at: Date.now(),
    ...extra,
  };
}

export async function joinMember(t: T, handle: string): Promise<string> {
  const token = `tok-${handle}`;
  await t.mutation(internal.members.join, { handle, tokenHash: await sha256Hex(token) });
  return token;
}

export async function hook(t: T, token: string, env: IngestEnvelope) {
  return t.mutation(internal.events.ingest, {
    tokenHash: await sha256Hex(token),
    hook: env.hook,
    envelope: env,
  });
}
