"use node";

import { GoogleGenAI } from "@google/genai";
import {
  type Distiller,
  type Embedder,
  JUDGE_SYSTEM,
  type Judge,
  judgePrompt,
  parseJudgeOutput,
} from "@lb/core";
import { judgeSchema } from "./schema";

export const EMBED_DIM = 768;
// Defaults to verify in M0; override with GEMINI_EMBED_MODEL / GEMINI_JUDGE_MODEL.
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";
// Tried in order: a busy (503) or slow model falls through to the next instead of silently dropping the verdict.
const JUDGE_MODELS = (
  process.env.GEMINI_JUDGE_MODELS ??
  process.env.GEMINI_JUDGE_MODEL ??
  "gemini-3.5-flash-lite,gemini-3.1-flash-lite"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const TIMEOUT_MS = 8000;

function client(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

export function geminiEmbedder(apiKey: string): Embedder {
  const ai = client(apiKey);
  return {
    async embed(texts) {
      const res = await ai.models.embedContent({
        model: EMBED_MODEL,
        contents: texts,
        config: {
          outputDimensionality: EMBED_DIM,
          taskType: "SEMANTIC_SIMILARITY",
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        },
      });
      const vectors = (res.embeddings ?? []).map((e) => e.values ?? []);
      if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBED_DIM)) {
        throw new Error(`gemini embed: expected ${texts.length}×${EMBED_DIM}`);
      }
      return vectors;
    },
  };
}

async function generate(
  ai: GoogleGenAI,
  system: string,
  prompt: string,
  json: boolean,
): Promise<string | null> {
  let lastError: unknown;
  for (const model of JUDGE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await generateWith(ai, model, system, prompt, json);
      } catch (e) {
        lastError = e;
        const wait = retryDelayMs(e);
        // Rate limited: wait as told (bounded) and retry once; any other failure moves to the next model.
        if (wait === null || attempt > 0) break;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}

/** Milliseconds to wait on a 429 (from the API's retryDelay when present), else null. Capped at 4 s. */
function retryDelayMs(e: unknown): number | null {
  const text = String(e);
  if (!/\b429\b|RESOURCE_EXHAUSTED/.test(text)) return null;
  const seconds = Number(/retryDelay[^0-9]*([0-9.]+)s/.exec(text)?.[1] ?? 1);
  return Math.min(4000, Math.max(500, seconds * 1000));
}

async function generateWith(
  ai: GoogleGenAI,
  model: string,
  system: string,
  prompt: string,
  json: boolean,
): Promise<string | null> {
  const res = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: system,
      temperature: 0,
      maxOutputTokens: 1024,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      ...(json ? { responseMimeType: "application/json", responseJsonSchema: judgeSchema() } : {}),
    },
  });
  return res.text ?? null;
}

export function geminiJudge(apiKey: string): Judge & Distiller {
  const ai = client(apiKey);
  return {
    async judge(pair, hints, examples) {
      const raw = await generate(ai, JUDGE_SYSTEM, judgePrompt(pair, hints, examples), true);
      return raw ? parseJudgeOutput(raw, pair, hints) : null;
    },
    distill(prompt) {
      return generate(ai, "You write terse engineering post-mortems.", prompt, false);
    },
  };
}
