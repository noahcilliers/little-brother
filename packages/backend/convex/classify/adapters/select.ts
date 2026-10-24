"use node";

import type { Distiller, Embedder, Judge } from "@lb/core";
import { claudeJudge } from "./claude";
import { geminiEmbedder, geminiJudge } from "./gemini";

/** CLASSIFIER_EMBEDDER=gemini|none (default gemini when a key is set). Null means rules + lexical only. */
export function selectEmbedder(env: NodeJS.ProcessEnv = process.env): Embedder | null {
  const choice = env.CLASSIFIER_EMBEDDER ?? "gemini";
  if (choice === "gemini" && env.GEMINI_API_KEY) return geminiEmbedder(env.GEMINI_API_KEY);
  return null;
}

/** CLASSIFIER_JUDGE=gemini|claude|none (default gemini). Null means unsettled pairs get fallback judgments. */
export function selectJudge(env: NodeJS.ProcessEnv = process.env): (Judge & Distiller) | null {
  const choice = env.CLASSIFIER_JUDGE ?? "gemini";
  if (choice === "gemini" && env.GEMINI_API_KEY) return geminiJudge(env.GEMINI_API_KEY);
  if (choice === "claude" && env.ANTHROPIC_API_KEY) return claudeJudge(env.ANTHROPIC_API_KEY);
  return null;
}
