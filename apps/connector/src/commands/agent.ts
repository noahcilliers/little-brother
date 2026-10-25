import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { agentSystemPrompt, type ChatModel, type Price, parsePrice, priceFor } from "@lb/core";
import { z } from "zod";
import { stdoutEmitter, transcriptWriter } from "../agent/emit";
import { hookBridge } from "../agent/hooks";
import { runAgent } from "../agent/loop";
import { geminiModel } from "../agent/providers/gemini";
import { openAIModel } from "../agent/providers/openai";
import { sessionDir } from "../hook/session-file";

export type AgentOptions = {
  provider: string;
  model: string;
  baseUrl?: string;
  session?: string;
  sessionId?: string;
  maxTurns: string;
  maxBudgetUsd?: string;
  maxTokens?: string;
  cwd?: string;
  hooks: boolean;
  holdSessionEnd?: boolean;
  appendSystemPrompt?: string;
  transcript?: string;
  price?: string;
};

const DEFAULT_OPENAI_URL = "http://localhost:11434/v1";
const PriceTable = z.record(z.object({ input: z.number(), output: z.number(), cached: z.number() }));

function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return Promise.resolve("");
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c: Buffer) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", () => resolve(""));
  });
}

function makeModel(o: AgentOptions): ChatModel {
  const maxTokens = o.maxTokens ? Number(o.maxTokens) : undefined;
  if (o.provider === "gemini") {
    const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    if (!key) throw new Error("set GEMINI_API_KEY for --provider gemini");
    const models = o.model
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    return geminiModel(models, key, maxTokens);
  }
  if (o.provider === "openai")
    return openAIModel(o.model, o.baseUrl ?? DEFAULT_OPENAI_URL, process.env.OPENAI_API_KEY, maxTokens);
  throw new Error(`unknown --provider ${o.provider}: use gemini or openai`);
}

function price(o: AgentOptions): Price {
  if (o.price) {
    const p = parsePrice(o.price);
    if (!p) throw new Error("--price must look like 0.3/2.5 (USD per million input/output tokens)");
    return p;
  }
  let overrides: Record<string, Price> | undefined;
  try {
    const parsed = PriceTable.safeParse(JSON.parse(process.env.LB_AGENT_PRICES ?? "null"));
    if (parsed.success) overrides = parsed.data;
  } catch {
    // a malformed override falls back to the built-in table
  }
  const baseUrl = o.provider === "openai" ? (o.baseUrl ?? DEFAULT_OPENAI_URL) : undefined;
  return priceFor(o.model.split(",")[0] ?? o.model, {
    ...(baseUrl ? { baseUrl } : {}),
    ...(overrides ? { overrides } : {}),
  });
}

/** `lb agent`: a Gemini or OpenAI-compatible coding agent whose tool calls run through Little Brother's hooks. */
export async function agentCommand(promptArg: string | undefined, o: AgentOptions): Promise<void> {
  const prompt = (promptArg ?? (await readStdin())).trim();
  if (!prompt) throw new Error("no prompt: pass it as an argument or on stdin");
  const maxTurns = Number(o.maxTurns);
  if (!Number.isInteger(maxTurns) || maxTurns < 1) throw new Error("--max-turns must be a positive integer");
  if (o.session) process.env.LB_SESSION = o.session;
  const cwd = realpathSync(o.cwd ?? process.cwd());
  const sessionId = o.sessionId ?? randomUUID();
  const transcriptPath = o.transcript ?? join(sessionDir(), "agent-transcripts", `${sessionId}.jsonl`);
  const emit = stdoutEmitter();
  const final = await runAgent({
    model: makeModel(o),
    sessionId,
    cwd,
    prompt,
    system: agentSystemPrompt(cwd, o.appendSystemPrompt),
    hooks: hookBridge({
      enabled: o.hooks,
      sessionId,
      cwd,
      transcriptPath,
      background: true,
      ...(process.env.LB_TIMING_FILE ? { timingFile: process.env.LB_TIMING_FILE } : {}),
      onError: (event, error) => {
        if (process.env.LB_DEBUG) process.stderr.write(`lb agent: ${event} hook: ${error}\n`);
      },
    }),
    hooksEnabled: o.hooks,
    emit,
    transcript: transcriptWriter(transcriptPath),
    maxTurns,
    ...(o.maxBudgetUsd ? { maxBudgetUsd: Number(o.maxBudgetUsd) } : {}),
    price: price(o),
    holdSessionEnd: o.holdSessionEnd === true,
  });
  const t = final.tokens;
  process.stderr.write(
    `lb agent: ${final.reason} after ${final.turns} turns · ${t.input + t.cached} in (${t.cached} cached) / ${t.output} out tokens · est. $${final.costUsd.toFixed(4)}\n`,
  );
  if (final.reason === "error") process.exitCode = 1;
}
