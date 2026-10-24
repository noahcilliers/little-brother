import type { HookTiming } from "@lb/core";
import { describe, expect, it } from "vitest";
import { hookUsage, parseTimingLog } from "../src/hook-timing";
import { latencyMetrics, percentile } from "../src/latency";

const call = (over: Partial<HookTiming>): HookTiming => ({
  event: "PreToolUse",
  at: 0,
  totalMs: 100,
  bootMs: 40,
  phases: { deliver: 50, git: 10 },
  delivered: true,
  timedOut: false,
  injectedChars: 0,
  ...over,
});

describe("parseTimingLog", () => {
  it("keeps valid lines and drops cut-off or foreign ones", () => {
    const text = [JSON.stringify(call({})), '{"event":"Pre', "", '{"other":1}'].join("\n");
    expect(parseTimingLog(text)).toHaveLength(1);
  });
});

describe("hookUsage", () => {
  it("keeps PreToolUse totals and sums phases over PreToolUse only", () => {
    const u = hookUsage(
      [
        call({ totalMs: 80 }),
        call({ totalMs: 120, injectedChars: 400, decision: "deny" }),
        call({ event: "PostToolUse", totalMs: 300, phases: { deliver: 250 } }),
        call({ event: "Stop", totalMs: 1900, timedOut: true }),
      ],
      5000,
    );
    expect(u.preToolUseMs).toEqual([80, 120]);
    expect(u.calls).toBe(4);
    expect(u.hookSec).toBeCloseTo(2.4);
    expect(u.timeouts).toBe(1);
    expect(u.prePhasesMs).toEqual({ boot: 80, deliver: 100, git: 20 });
    expect(u.injectedTokens).toBe(100);
    expect(u.tokensSaved).toBe(5000);
  });
});

describe("percentile", () => {
  it("uses nearest rank", () => {
    const xs = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(percentile(xs, 50)).toBe(10);
    expect(percentile(xs, 95)).toBe(19);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 50)).toBeNull();
  });
});

describe("latencyMetrics", () => {
  it("pools calls across runs and adds the spawn overhead to each", () => {
    const a = hookUsage([call({ totalMs: 100 }), call({ totalMs: 200 })], 1000);
    const b = hookUsage([call({ totalMs: 60, injectedChars: 800 })], 0);
    const m = latencyMetrics([a, b], 10);
    expect(m.preToolUseCalls).toBe(3);
    expect(m.p50Ms).toBe(110);
    expect(m.maxMs).toBe(210);
    expect(m.overTargetRate).toBeCloseTo(1 / 3);
    expect(m.hookSecPerRun).toBeCloseTo((0.36 + 0.03) / 2);
    expect(m.phaseMsPerCall[0]).toEqual(["deliver", 50]);
    expect(m.netTokens).toBe(1000 - 200);
  });

  it("is empty without logs", () => {
    const m = latencyMetrics([]);
    expect(m.p95Ms).toBeNull();
    expect(m.hookSecPerRun).toBeNull();
    expect(m.phaseMsPerCall).toEqual([]);
  });
});
