/**
 * Whether a run's agents have Little Brother. `off` runs the same agents and prompts with no plugin, hooks or
 * MCP server, so measured savings come from comparing the two rather than from the catch-based estimate.
 * Named "arm" because "control" already means a case with no planted clash.
 */
export type Arm = "on" | "off";

/** Runs recorded before arms existed all had Little Brother on. */
export const armOf = (r: { arm?: Arm }): Arm => r.arm ?? "on";
