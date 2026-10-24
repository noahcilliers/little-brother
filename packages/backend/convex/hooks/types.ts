import type { HookOutput, IngestEnvelope } from "@lb/core";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type HookInput = {
  ctx: MutationCtx;
  hook: string;
  agent: Doc<"agents">;
  env: IngestEnvelope;
  eventId: Id<"events">;
};

export type HookResult = {
  output: HookOutput;
  summary: string;
  nodeId?: Id<"nodes">;
  tokens?: number;
};

export type HookHandler = (input: HookInput) => Promise<HookResult>;
