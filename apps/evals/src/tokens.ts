import type { TokenCounts } from "@lb/core";

export const ZERO_TOKENS: TokenCounts = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 };

export function addTokens(a: TokenCounts, b: TokenCounts): TokenCounts {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheCreation: a.cacheCreation + b.cacheCreation,
    cacheRead: a.cacheRead + b.cacheRead,
  };
}

export function maxTokens(a: TokenCounts, b: TokenCounts): TokenCounts {
  return {
    input: Math.max(a.input, b.input),
    output: Math.max(a.output, b.output),
    cacheCreation: Math.max(a.cacheCreation, b.cacheCreation),
    cacheRead: Math.max(a.cacheRead, b.cacheRead),
  };
}
