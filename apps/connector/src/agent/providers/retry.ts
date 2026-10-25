/** A provider call that failed; `status` is the HTTP status when there was a response. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

/** Longer than this is a spent daily quota, not a busy minute: waiting it out would stall the run for hours. */
const MAX_HINT_MS = 5 * 60_000;

/** No status means the request never got an answer (network, timeout): worth another try. */
export const retryable = (e: unknown): boolean => {
  if (!(e instanceof ProviderError)) return true;
  if ((e.retryAfterMs ?? 0) > MAX_HINT_MS) return false;
  const status = e.status;
  return status === undefined || status === 408 || status === 429 || status >= 500;
};

/** Gemini's 429 body says how long to wait (`"retryDelay": "37s"`); HTTP has Retry-After. */
export function retryAfterMs(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const gemini = /retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/.exec(text);
  if (gemini) return Number(gemini[1]) * 1000;
  const prose = /retry in (?:(\d+)h)?(?:(\d+)m)?(\d+(?:\.\d+)?)s/.exec(text);
  if (prose) return ((Number(prose[1] ?? 0) * 60 + Number(prose[2] ?? 0)) * 60 + Number(prose[3])) * 1000;
  const seconds = Number(text);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

export const backoffMs = (attempt: number, hintMs: number | undefined, maxMs: number): number =>
  Math.min(maxMs, hintMs ?? 2000 * 2 ** attempt + Math.floor(Math.random() * 500));

export type RetryOptions = {
  attempts?: number;
  maxDelayMs?: number;
  onRetry?: (e: unknown, waitMs: number, attempt: number) => void;
  sleep?: (ms: number) => Promise<void>;
};

/** Free-tier Gemini rate-limits per minute and local servers drop connections; both pass with a wait. */
export async function withRetry<T>(fn: () => Promise<T>, o: RetryOptions = {}): Promise<T> {
  const attempts = o.attempts ?? 6;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt + 1 >= attempts || !retryable(e)) throw e;
      const wait = backoffMs(
        attempt,
        e instanceof ProviderError ? e.retryAfterMs : undefined,
        o.maxDelayMs ?? 60_000,
      );
      o.onRetry?.(e, wait, attempt + 1);
      await sleep(wait);
    }
  }
}
