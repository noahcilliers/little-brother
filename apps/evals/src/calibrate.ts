import { spawnSync } from "node:child_process";
import { percentile } from "./latency";

/**
 * Per-call process cost that `lb hook`'s own clock can't see: the exec before Node sets its time origin
 * and the teardown after the last write. Measured as wall time to spawn Node minus what Node reports at
 * its first line, median of `n` spawns; this machine's figure, added to every timed call.
 */
export function spawnOverheadMs(n = 15): number {
  const gaps: number[] = [];
  for (let i = 0; i < n; i++) {
    const start = process.hrtime.bigint();
    const r = spawnSync(process.execPath, ["-e", "process.stdout.write(String(performance.now()))"], {
      encoding: "utf8",
    });
    const outer = Number(process.hrtime.bigint() - start) / 1e6;
    const inner = Number(r.stdout);
    if (r.status === 0 && Number.isFinite(inner)) gaps.push(outer - inner);
  }
  return Math.round((percentile(gaps, 50) ?? 0) * 10) / 10;
}
