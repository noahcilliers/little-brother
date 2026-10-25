/**
 * What coordination a run's agents get. `on` is Little Brother (plugin, hooks and MCP server); `off` is the
 * same agents and prompts with none of it. `msg` is the published coordination baseline (CooperBench's
 * cooperative setting): no Little Brother, but a shared mailbox the agents can send and read. `oracle` is
 * STALE-bench's "informed" condition: the consumer's prompt carries a hand-written note about the concurrent
 * interface change. Named "arm" because "control" already means a case with no planted clash.
 */
export type Arm = "on" | "off" | "msg" | "oracle";
export const ARMS: readonly Arm[] = ["off", "on", "msg", "oracle"];

/** Runs recorded before arms existed all had Little Brother on. */
export const armOf = (r: { arm?: Arm }): Arm => r.arm ?? "on";

/** Run directory suffix: `on` keeps the historical bare name. */
export const armTag = (arm: Arm): string => (arm === "on" ? "" : `-${arm}`);
