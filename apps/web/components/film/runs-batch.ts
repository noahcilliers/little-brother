// The two real eval batches the benchmark timelapse replays, rows in the order the runs finished, copied from
// apps/evals/results/<batch>.log: STALE-bench haiku-1025/stale-b (Haiku agents, all four arms, 48 runs that took
// 26 min 21 s end to end) and CooperBench pilot-1024b/cooper (Sonnet agents, off vs on, 20 runs).

/** off · messaging · told in advance · Little Brother, as the eval logs name them. */
export type Arm = "LB-off" | "msg" | "oracle" | "LB-on";
/** Detection outcome; only LB-on runs have one. */
export type Outcome = "hit" | "miss" | "mislabel" | "unmaterialized" | "";
/** [case id, arm, run #, wall seconds, per-agent "solved" marks, outcome] */
export type RunRow = [caseId: string, arm: Arm, n: number, wallSec: number, solved: string, outcome: Outcome];

export const STALE_ELAPSED_S = 26 * 60 + 21;

// biome-ignore format: one run per row, as logged
export const STALE_RUNS: RunRow[] = [
  ["get_valid_filename__rettype", "msg", 3, 51, "✓✓", ""], ["get_valid_filename__rettype", "oracle", 3, 54, "✓✓", ""],
  ["get_valid_filename__rettype", "LB-off", 3, 50, "✓✓", ""], ["get_valid_filename__rettype", "LB-on", 3, 65, "✓✗", "mislabel"],
  ["slugify__signature", "oracle", 3, 46, "✓✓", ""], ["slugify__signature", "LB-on", 3, 47, "✓✓", "miss"],
  ["slugify__signature", "LB-off", 3, 39, "✓✓", ""], ["slugify__signature", "msg", 3, 64, "✓✓", ""],
  ["capfirst__rename", "LB-off", 3, 82, "✓✓", ""], ["capfirst__rename", "msg", 3, 85, "✓✓", ""],
  ["capfirst__rename", "oracle", 3, 89, "✓✓", ""], ["capfirst__rename", "LB-on", 3, 87, "✓✗", "hit"],
  ["slugify__signature", "oracle", 4, 66, "✓✗", ""], ["slugify__signature", "msg", 4, 54, "✓✓", ""],
  ["slugify__signature", "LB-off", 4, 70, "✓✓", ""], ["base36_to_int__rename", "oracle", 4, 69, "✓✓", ""],
  ["base36_to_int__rename", "LB-off", 4, 42, "✓✓", ""], ["slugify__signature", "LB-on", 4, 78, "✓✓", "miss"],
  ["base36_to_int__rename", "LB-on", 4, 102, "✓✗", "hit"], ["base36_to_int__rename", "msg", 4, 49, "✓✓", ""],
  ["urlencode__rettype", "LB-on", 4, 128, "✓✗", "mislabel"], ["urlencode__rettype", "msg", 4, 184, "✓✓", ""],
  ["urlencode__rettype", "LB-off", 4, 201, "✓✓", ""], ["urlencode__rettype", "oracle", 4, 168, "✓✓", ""],
  ["strip_tags__signature", "oracle", 3, 113, "✗✗", ""], ["strip_tags__signature", "LB-off", 3, 123, "✗✓", ""],
  ["strip_tags__signature", "LB-on", 3, 159, "✗✗", "hit"], ["strip_tags__signature", "msg", 3, 139, "✗✓", ""],
  ["get_valid_filename__rettype", "oracle", 4, 52, "✓✓", ""], ["get_valid_filename__rettype", "LB-on", 4, 58, "✓✗", "mislabel"],
  ["get_valid_filename__rettype", "LB-off", 4, 46, "✓✓", ""], ["get_valid_filename__rettype", "msg", 4, 60, "✓✓", ""],
  ["capfirst__rename", "oracle", 4, 117, "✓✓", ""], ["capfirst__rename", "LB-on", 4, 135, "✓✗", "hit"],
  ["capfirst__rename", "LB-off", 4, 133, "✓✓", ""], ["capfirst__rename", "msg", 4, 122, "✓✓", ""],
  ["urlencode__rettype", "LB-off", 3, 85, "✓✓", ""], ["urlencode__rettype", "LB-on", 3, 120, "✓✗", "mislabel"],
  ["urlencode__rettype", "msg", 3, 127, "✓✓", ""], ["urlencode__rettype", "oracle", 3, 176, "✓✓", ""],
  ["base36_to_int__rename", "oracle", 3, 111, "✓✓", ""], ["base36_to_int__rename", "LB-off", 3, 79, "✓✓", ""],
  ["base36_to_int__rename", "LB-on", 3, 84, "✓✗", "hit"], ["base36_to_int__rename", "msg", 3, 65, "✓✓", ""],
  ["strip_tags__signature", "msg", 4, 126, "✗✓", ""], ["strip_tags__signature", "LB-off", 4, 129, "✗✓", ""],
  ["strip_tags__signature", "oracle", 4, 168, "✗✗", ""], ["strip_tags__signature", "LB-on", 4, 180, "✗✗", "hit"],
];

// biome-ignore format: one run per row, as logged
export const COOPER_RUNS: RunRow[] = [
  ["pallets_jinja_task/1621/2+10", "LB-off", 1, 32, "✓✓", ""], ["samuelcolvin_dirty_equals_task/43/1+2", "LB-off", 2, 23, "✓✓", ""],
  ["pallets_jinja_task/1621/2+10", "LB-on", 1, 52, "✓✓", "unmaterialized"], ["pallets_jinja_task/1559/6+10", "LB-off", 1, 17, "✓✓", ""],
  ["samuelcolvin_dirty_equals_task/43/1+2", "LB-on", 2, 37, "✓✗", "mislabel"], ["pallets_jinja_task/1559/6+10", "LB-on", 1, 27, "✗✓", "mislabel"],
  ["pallets_jinja_task/1621/5+8", "LB-on", 2, 37, "✓✓", "hit"], ["pallets_jinja_task/1621/5+8", "LB-off", 2, 67, "✓✓", ""],
  ["pallets_click_task/2800/2+6", "LB-on", 1, 37, "✓✓", "unmaterialized"], ["pallets_click_task/2800/2+6", "LB-off", 1, 40, "✓✓", ""],
  ["pallets_click_task/2800/2+6", "LB-off", 2, 31, "✓✓", ""], ["samuelcolvin_dirty_equals_task/43/1+2", "LB-off", 1, 26, "✗✓", ""],
  ["pallets_click_task/2800/2+6", "LB-on", 2, 37, "✓✓", "unmaterialized"], ["pallets_jinja_task/1621/2+10", "LB-off", 2, 27, "✓✓", ""],
  ["pallets_jinja_task/1621/2+10", "LB-on", 2, 35, "✓✓", "miss"], ["samuelcolvin_dirty_equals_task/43/1+2", "LB-on", 1, 82, "✓✓", "hit"],
  ["pallets_jinja_task/1559/6+10", "LB-off", 2, 22, "✓✓", ""], ["pallets_jinja_task/1559/6+10", "LB-on", 2, 38, "✓✗", "mislabel"],
  ["pallets_jinja_task/1621/5+8", "LB-off", 1, 56, "✓✓", ""], ["pallets_jinja_task/1621/5+8", "LB-on", 1, 81, "✓✓", "unmaterialized"],
];
