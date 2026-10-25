import { type ChatModel, type ChatTurn, geminiContents, geminiTools, parseGeminiResponse } from "@lb/core";
import { ProviderError, retryAfterMs, retryable } from "./retry";

// Plain fetch on the REST API rather than @google/genai: inlined into the single-file lb.mjs, the SDK added
// ~35 ms to every `lb hook` start, and the request and response shapes are already built in @lb/core.
const API = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 180_000;
const MALFORMED = "Your last function call was malformed. Call the tool again with valid JSON arguments.";

/** A model that can't serve today (spent daily quota, unknown id) hands the conversation to the next one. */
const exhausted = (e: unknown): boolean =>
  e instanceof ProviderError && (e.status === 404 || (e.status === 429 && !retryable(e)));

async function generate(model: string, apiKey: string, body: unknown): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new ProviderError(`gemini ${model}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const text = await res.text();
  // Gemini says how long to wait in the body (RetryInfo, "Please retry in 17s"), not in a header.
  if (!res.ok)
    throw new ProviderError(
      `gemini ${model}: ${res.status} ${text.slice(0, 500)}`,
      res.status,
      retryAfterMs(text),
    );
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError(`gemini ${model}: non-JSON reply ${text.slice(0, 200)}`, 502);
  }
}

/**
 * Gemini with function calling. `models` is tried in order: the free tier caps requests per model per day,
 * so a list such as `gemini-3.6-flash,gemini-3-flash-preview` keeps a long run going (another model accepts
 * the first one's thought signatures). A MALFORMED_FUNCTION_CALL finish has no parts at all; the turn carries
 * a note so the loop tells the model and lets it retry instead of treating silence as "done".
 */
export function geminiModel(models: string[], apiKey: string, maxTokens = 8192): ChatModel {
  let calls = 0;
  let current = 0;
  const modelId = (): string => models[current] ?? models[0] ?? "";
  return {
    provider: "gemini",
    get model() {
      return modelId();
    },
    async complete(req): Promise<ChatTurn> {
      const body = {
        contents: geminiContents(req.messages),
        systemInstruction: { parts: [{ text: req.system }] },
        tools: geminiTools(req.tools),
        generationConfig: { maxOutputTokens: maxTokens },
      };
      let res: unknown;
      for (;;) {
        try {
          res = await generate(modelId(), apiKey, body);
          break;
        } catch (e) {
          if (!exhausted(e) || current + 1 >= models.length) throw e;
          current++;
        }
      }
      calls++;
      const { finishReason, ...turn } = parseGeminiResponse(res, `gm_${Date.now().toString(36)}_${calls}`);
      if (finishReason === "MALFORMED_FUNCTION_CALL" && turn.toolCalls.length === 0)
        return { ...turn, malformed: MALFORMED };
      return turn;
    },
  };
}
