// What the film says and where it looks: captions, the focused session pane, and the camera.

export type Scene = [t: number, tag: string, text: string, focus: string[]];
// biome-ignore format: tabular scenario data
export const SCENES: Scene[] = [
  [0, "Setup", "Three developers run Claude Code on their own laptops and accounts. Each agent only sees its own session.", []],
  [3.4, "Observe", "Every prompt, edit and command becomes a node. Noah's agent tries a CORS fix, it fails, then a proxy works.", ["n2", "n3", "n4"]],
  [10, "Learn", "The failure is stored as knowledge: what was tried, why it failed, what worked.", ["n5", "n2", "n3", "n4"]],
  [11.2, "Duplicate", "Joshua's agent starts its own users table. Noah owns it, so the write is denied and the agent imports Noah's User instead.", ["j1", "n1", "j2"]],
  [15, "Stale", "Ash's agent sets out to add CORS middleware. Before its first edit it learns that path failed and what worked, and goes straight to the proxy.", ["a2", "n5", "a3"]],
  [21.4, "Conflict", "Joshua's checkout reads a cookie session. Noah's agent switches auth to JWT. Each passes its own tests.", ["j3", "n6"]],
  [25.2, "Conflict", "Both touch auth.mechanism. Little Brother sends it to the owner with both sides as evidence.", ["j3", "n6"]],
  [30.2, "Resolve", "Noah approves JWT. It's pushed into Joshua's running session and only the superseded step is redone.", ["n6", "j3", "j4"]],
  [36.2, "Verify", "lb verify merges all three branches and runs the integration test. Nothing is left to fix at merge.", ["v", "j4", "n6", "a3"]],
  [40.5, "Done", "Three catches before push. Same three agents, same three prompts.", []],
];

export type PaneKey = "joshua" | "ash" | "noah" | "resolve" | "verify";
// biome-ignore format: tabular scenario data
export const FOCUS: [t: number, pane: PaneKey][] = [
  [0, "joshua"], [14.6, "ash"], [21, "joshua"], [23.2, "noah"], [26.4, "resolve"], [31, "joshua"], [36.2, "verify"],
];
export const PANE: Record<PaneKey, [title: string, sub: string]> = {
  joshua: ["Joshua · checkout", "claude code · joshua/checkout"],
  ash: ["Ash · frontend", "claude code · ash/frontend"],
  noah: ["Noah · auth", "claude code · noah/auth"],
  resolve: ["Resolve · auth.mechanism", "dashboard · owner noah"],
  verify: ["Terminal", "lb verify"],
};

// biome-ignore format: tabular scenario data
export const CHAPTERS: [t: number, name: string][] = [
  [0, "Setup"], [11.2, "Duplicate"], [15, "Stale"], [21.4, "Conflict"], [30.2, "Resolve"], [36.2, "Verify"],
];
// biome-ignore format: tabular scenario data
export const CATCHES: [t: number, count: string, tokens: string][] = [
  [12, "1", "6.2k"], [16.8, "2", "24.6k"], [30.6, "3", "33.9k"],
];

/** [startAt, zoom, centerX, centerY] in stage coordinates; each move eases over CAM_MOVE seconds. */
// biome-ignore format: tabular scenario data
export const CAMERA: [t: number, zoom: number, cx: number, cy: number][] = [
  [0, 1, 600, 330], [3.4, 1.45, 370, 250], [10.6, 1, 600, 330], [11.6, 1.8, 965, 160],
  [14.2, 1.45, 300, 160], [15.4, 1, 600, 330], [16.4, 1.8, 965, 170], [18.4, 1.5, 470, 280],
  [20.8, 1, 600, 330], [22.2, 1.5, 260, 420], [26.2, 1.75, 965, 170], [31, 1.7, 965, 180],
  [34.8, 1, 600, 330], [36.6, 1.6, 965, 160], [39.6, 1, 600, 330], [41, 1.9, 1060, 610], [43, 1, 600, 330],
];
export const CAM_MOVE = 1.1;
// biome-ignore format: tabular scenario data
export const CURSOR: [t: number, x: number, y: number][] = [[27.6, 1120, 600], [29.6, 842, 268], [30.8, 842, 268]];
