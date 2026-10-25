import { type ChatModel, openAIBody, parseOpenAIResponse, TOOL_SCHEMAS } from "@lb/core";
import { ProviderError, retryAfterMs } from "./retry";

const KNOWN = new Set(TOOL_SCHEMAS.map((t) => t.name));
// A 7B model on a laptop can take minutes on a long prompt.
const TIMEOUT_MS = 10 * 60_000;

/** Any OpenAI-compatible /v1/chat/completions: Ollama, LM Studio, vLLM, OpenAI. Plain fetch, no SDK. */
export function openAIModel(model: string, baseUrl: string, apiKey?: string, maxTokens = 4096): ChatModel {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  let calls = 0;
  return {
    provider: "openai",
    model,
    async complete(req) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify(openAIBody(model, req, maxTokens)),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (e) {
        throw new ProviderError(`${url}: ${e instanceof Error ? e.message : String(e)}`);
      }
      const text = await res.text();
      if (!res.ok)
        throw new ProviderError(
          `${res.status} from ${url}: ${text.slice(0, 400)}`,
          res.status,
          retryAfterMs(res.headers.get("retry-after")),
        );
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new ProviderError(`non-JSON reply from ${url}: ${text.slice(0, 200)}`, 502);
      }
      calls++;
      return parseOpenAIResponse(body, `oa_${Date.now().toString(36)}_${calls}`, KNOWN);
    },
  };
}
