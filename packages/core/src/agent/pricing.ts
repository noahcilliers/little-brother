import type { ChatUsage } from "./chat";

/** USD per million tokens. `cached` is the rate for prompt tokens served from the provider's cache. */
export type Price = { input: number; output: number; cached: number };

const FREE: Price = { input: 0, output: 0, cached: 0 };

/**
 * List prices at the time of writing, matched by longest model-id prefix. An estimate for comparing runs, not
 * a bill: override with `--price in/out` or LB_AGENT_PRICES (a JSON object of the same shape).
 */
export const DEFAULT_PRICES: Record<string, Price> = {
  "gemini-2.0-flash": { input: 0.1, output: 0.4, cached: 0.025 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4, cached: 0.01 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5, cached: 0.03 },
  "gemini-2.5-pro": { input: 1.25, output: 10, cached: 0.125 },
  "gemini-3-flash": { input: 0.5, output: 3, cached: 0.05 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5, cached: 0.025 },
  "gemini-3.5-flash-lite": { input: 0.25, output: 1.5, cached: 0.025 },
  "gemini-3.5-flash": { input: 0.5, output: 3, cached: 0.05 },
  "gemini-3-pro": { input: 2, output: 12, cached: 0.2 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cached: 0.075 },
};

/** Gemini versions newer than the table, priced by tier; the newest models change faster than this file. */
const GEMINI_TIERS: [RegExp, string][] = [
  [/^gemini-.*flash-lite/, "gemini-3.5-flash-lite"],
  [/^gemini-.*flash/, "gemini-3.5-flash"],
  [/^gemini-.*pro/, "gemini-3-pro"],
];

const LOCAL_URL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/;

/** A model served from this machine costs nothing per token; an unknown hosted model is priced at zero too. */
export function priceFor(
  model: string,
  opts: { baseUrl?: string; overrides?: Record<string, Price> } = {},
): Price {
  if (opts.baseUrl && LOCAL_URL.test(opts.baseUrl)) return opts.overrides?.[model] ?? FREE;
  const table = { ...DEFAULT_PRICES, ...opts.overrides };
  const id = model.replace(/^models\//, "");
  const key = Object.keys(table)
    .filter((k) => id.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  const tier = key ? undefined : GEMINI_TIERS.find(([re]) => re.test(id))?.[1];
  return table[key ?? tier ?? ""] ?? FREE;
}

/** Parses `--price 0.3/2.5` (input/output per million tokens; cached defaults to a tenth of input). */
export function parsePrice(text: string): Price | null {
  const m = /^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/.exec(text);
  if (!m) return null;
  const input = Number(m[1]);
  const output = Number(m[2]);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  return { input, output, cached: input / 10 };
}

export const costUsd = (u: ChatUsage, p: Price): number =>
  (u.input * p.input + u.output * p.output + u.cached * p.cached) / 1_000_000;

export const addUsage = (a: ChatUsage, b: ChatUsage): ChatUsage => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cached: a.cached + b.cached,
});
