import { DAY, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components } from "../_generated/api";
import { internalMutation } from "../_generated/server";

/** The most judge calls one classifier run asks for at once. */
export const MAX_CALLS_PER_RUN = 4;

// The limiter throws on a request larger than a limit's whole capacity, so no limit goes below one run.
const limitFrom = (raw: string | undefined, fallback: number): number => {
  const n = Number(raw);
  return Math.max(MAX_CALLS_PER_RUN, Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback);
};

// The plan's global rate limit and daily cost cap on model calls. A judge call costs roughly the same every
// time (one prompt, at most 1024 output tokens), so a call count stands in for spend.
const PER_MINUTE = limitFrom(process.env.JUDGE_CALLS_PER_MINUTE, 120);
const PER_DAY = limitFrom(process.env.JUDGE_CALLS_PER_DAY, 5000);

const limits = new RateLimiter(components.rateLimiter, {
  judgeCallsPerMinute: { kind: "token bucket", rate: PER_MINUTE, period: MINUTE },
  judgeCallsPerDay: { kind: "fixed window", rate: PER_DAY, period: DAY },
});

export type Admission = { ok: true } | { ok: false; limit: "minute" | "day"; retryAfter: number };

/**
 * Reserves `calls` model calls against both limits, all or nothing: both are checked before either is spent,
 * so a refusal by one never uses up the other.
 */
export const admit = internalMutation({
  args: { calls: v.number() },
  handler: async (ctx, { calls }): Promise<Admission> => {
    if (calls <= 0) return { ok: true };
    const day = await limits.check(ctx, "judgeCallsPerDay", { count: calls });
    if (!day.ok) return { ok: false, limit: "day", retryAfter: day.retryAfter };
    const minute = await limits.check(ctx, "judgeCallsPerMinute", { count: calls });
    if (!minute.ok) return { ok: false, limit: "minute", retryAfter: minute.retryAfter };
    await limits.limit(ctx, "judgeCallsPerDay", { count: calls });
    await limits.limit(ctx, "judgeCallsPerMinute", { count: calls });
    return { ok: true };
  },
});
