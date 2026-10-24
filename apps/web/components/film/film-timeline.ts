// The film's script: when each scene plays, the chapters on the scrubber, the subtitle line, and the story beats
// every pane keys off. Times are story seconds on the one film clock.

export type SceneId = "hook" | "story" | "how" | "learn" | "metrics" | "close";
export type Transition = "cut" | "zoom" | "wipe" | "iris";

/** [start, end, how it enters]. Scenes overlap their neighbour by the transition length. */
export const SCENES: Record<SceneId, [start: number, end: number, enter: Transition]> = {
  hook: [0, 5.6, "cut"],
  story: [5.1, 41.4, "zoom"],
  how: [40.8, 48.9, "wipe"],
  learn: [48.4, 56.4, "iris"],
  metrics: [55.9, 70.4, "wipe"],
  close: [69.9, 75, "zoom"],
};
export const TRANSITION_S = 0.6;

// biome-ignore format: tabular scenario data
export const CHAPTERS: [s: number, name: string][] = [
  [0, "Hook"], [5.5, "Connect"], [18.8, "Duplicate"], [23.2, "Stale"], [28.4, "Conflict"],
  [41, "How it works"], [48.6, "Learning"], [56, "Metrics"], [70, "Close"],
];

// biome-ignore format: one subtitle per row
export const SUBS: [s: number, text: string][] = [
  [0, "Five agents, five sessions, zero shared context."],
  [5.6, "Ash hosts a session. Teammates join with a QR code or one command in Claude Code."],
  [8.8, "Noah asks to join from his phone. Ash admits him from the waiting room."],
  [10.4, "Each laptop joins with one slash command, and its agent appears as a lane."],
  [13.6, "Joshua drives his agent from his phone with Remote Control."],
  [16.2, "Every goal, task and tool call lands on one shared timeline."],
  [19.6, "Joshua's agent starts a users table that Noah's agent already built."],
  [20.8, "Denied in the PreToolUse hook. It imports Noah's User instead: ~6k tokens saved."],
  [23.4, "Ash's agent plans CORS middleware, the path Noah's agent proved fails."],
  [24.6, "Warned before the first edit, with what worked. Straight to the proxy."],
  [28.6, "Noah moves auth to JWT bearer while Ash builds cookie sessions."],
  [32.2, "Conflict. Edits on auth.mechanism pause and the owner sees both sides."],
  [34.2, "Noah decides from his phone."],
  [36.8, "The decision lands in Ash's session. Only the superseded step is redone."],
  [41, "How it works: a check on every tool call, without slowing the agent down."],
  [48.6, "Failures become lessons, decisions become labels, and the next verdict uses both."],
  [56, "Measured on a 6-agent replay and our test suites. Targets are labelled as targets."],
  [70, "Little Brother. Your agents, finally on the same page."],
];

/** Story beats shared by the dashboard, phones and terminals. */
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
