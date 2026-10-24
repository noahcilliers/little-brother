// The film's script: when each scene plays, the chapters on the scrubber, the subtitle line, and the story beats
// every pane keys off. Film times are seconds on the one clock; BEAT times are on the story's own clock.

export type SceneId = "hook" | "story" | "why" | "how" | "learn" | "measure" | "impact" | "close";
export type Transition = "cut" | "zoom" | "wipe" | "iris";

/** The story's clock runs this far behind the film's: story second x plays at film second x + STORY_SHIFT. */
export const STORY_SHIFT = 5.6;
const ST = STORY_SHIFT;

/** [start, end, how it enters]. Scenes overlap their neighbour by the transition length. */
export const SCENES: Record<SceneId, [start: number, end: number, enter: Transition]> = {
  hook: [0, 11.2, "cut"],
  story: [10.7, 45.2, "zoom"],
  why: [44.6, 53.6, "wipe"],
  how: [53, 60, "wipe"],
  learn: [59.4, 66.4, "iris"],
  measure: [65.8, 80.4, "zoom"],
  impact: [79.8, 83.8, "iris"],
  close: [83.2, 88, "zoom"],
};
export const TRANSITION_S = 0.6;

// biome-ignore format: tabular scenario data
export const CHAPTERS: [s: number, name: string][] = [
  [0, "Hook"], [ST + 5.5, "Connect"], [ST + 18.8, "Duplicate"], [ST + 23.2, "Stale"], [ST + 28.4, "Conflict"],
  [44.8, "Why not git"], [53.2, "How it works"], [59.6, "Learning"], [66, "Measure"], [80, "Impact"], [83.4, "Close"],
];

// biome-ignore format: one subtitle per row
export const SUBS: [s: number, text: string][] = [
  [0, "AI writes more of the code, and burns more tokens doing it."],
  [5.2, "Put several agents on one repo and they do worse, not better."],
  [7.6, "Each agent works blind to the others."],
  [ST + 5.6, "Ash hosts a session. Teammates join with a QR code or one command in Claude Code."],
  [ST + 8.8, "Noah asks to join from his phone. Ash admits him from the waiting room."],
  [ST + 10.4, "Each laptop joins with one slash command, and its agent appears as a lane."],
  [ST + 13.6, "Joshua drives his agent from his phone with Remote Control."],
  [ST + 16.2, "Every goal, task and tool call lands on one shared timeline."],
  [ST + 19.6, "Joshua's agent starts a users table that Noah's agent already built."],
  [ST + 21.6, "Denied in the PreToolUse hook. It imports Noah's User instead."],
  [ST + 23.4, "Ash's agent plans CORS middleware, the path Noah's agent proved fails."],
  [ST + 24.6, "Warned before the first edit, with what worked. Straight to the proxy."],
  [ST + 28.6, "Noah moves auth to JWT bearer while Ash builds cookie sessions."],
  [ST + 32.2, "Conflict. Edits on auth.mechanism pause and the owner sees both sides."],
  [ST + 35, "Noah decides from his phone."],
  [ST + 36.8, "The decision lands in Ash's session. Only the superseded step is redone."],
  [44.8, "Merges and instruction files can't see what teammates are doing right now."],
  [53.2, "A check on every tool call, without slowing the agent down."],
  [59.6, "Failures become lessons, decisions become labels, and the next verdict uses both."],
  [66, "What we measure, and what we're aiming for."],
  [80, "Fewer tokens burned, fewer failures repeated."],
  [83.4, "Little Brother. Your agents, finally on the same page."],
];

/** Story beats shared by the dashboard, phones and terminals, on the story's clock. */
export const BEAT = {
  shareClick: 6,
  qrShown: 6.4,
  scan: 7,
  joinCard: 8,
  askTap: 8.5,
  waitCard: 8.9,
  admit: 9.6,
  noahIn: 10,
  ashTypes: 10.4,
  ashIn: 11.8,
  joshTypes: 12.2,
  joshIn: 13.4,
  remoteType: 13.6,
  remoteSend: 15,
  dup: 20.6,
  stale: 24.4,
  conflict: 32,
  decideClick: 33,
  popup: 33.3,
  phoneDecision: 34.2,
  phoneTap: 36.2,
  resolve: 36.8,
  popupClose: 37.4,
} as const;
