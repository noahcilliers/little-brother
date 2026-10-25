import { ApiError, GoogleGenAI } from "@google/genai";
import { type ChatModel, type ChatTurn, geminiContents, geminiTools, parseGeminiResponse } from "@lb/core";
import { ProviderError, retryAfterMs, retryable } from "./retry";

const TIMEOUT_MS = 180_000;
const MALFORMED = "Your last function call was malformed. Call the tool again with valid JSON arguments.";

/** A model that can't serve today (spent daily quota, unknown id) hands the conversation to the next one. */
const exhausted = (e: unknown): boolean =>
  e instanceof ProviderError && (e.status === 404 || (e.status === 429 && !retryable(e)));

/**
 * Gemini with function calling. `models` is tried in order: the free tier caps requests per model per day,
 * so a list such as `gemini-3.6-flash,gemini-3-flash-preview` keeps a long run going. A
 * MALFORMED_FUNCTION_CALL finish has no parts at all; the turn carries a note so the loop tells the model and
 * lets it retry instead of treating silence as "done".
 */
export function geminiModel(models: string[], apiKey: string, maxTokens = 8192): ChatModel {
  const ai = new GoogleGenAI({ apiKey });
  let calls = 0;
  let current = 0;
  const modelId = (): string => models[current] ?? models[0] ?? "";

  async function call(req: Parameters<ChatModel["complete"]>[0]): Promise<unknown> {
    try {
      return await ai.models.generateContent({
        model: modelId(),
        contents: geminiContents(req.messages),
        config: {
          systemInstruction: req.system,
          tools: geminiTools(req.tools),
          maxOutputTokens: maxTokens,
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ProviderError(
        `gemini ${modelId()}: ${msg.slice(0, 500)}`,
        e instanceof ApiError ? e.status : undefined,
        retryAfterMs(msg),
      );
    }
  }

  return {
    provider: "gemini",
    get model() {
      return modelId();
    },
    async complete(req): Promise<ChatTurn> {
      let res: unknown;
      for (;;) {
        try {
          res = await call(req);
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
