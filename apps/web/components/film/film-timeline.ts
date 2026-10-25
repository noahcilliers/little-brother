// The film's script: when each scene plays, the chapters on the scrubber, the subtitle line, and the story beats
// every pane keys off. Times are seconds on the one film clock.

export type SceneId = "hook" | "story" | "why" | "how" | "learn" | "measure" | "impact" | "close";
export type Transition = "cut" | "zoom" | "wipe" | "iris";

/** [start, end, how it enters]. Scenes overlap their neighbour by the transition length. */
export const SCENES: Record<SceneId, [start: number, end: number, enter: Transition]> = {
  hook: [0, 5.6, "cut"],
  story: [5.1, 39.6, "zoom"],
  why: [39, 48, "wipe"],
  how: [47.4, 54.4, "wipe"],
  learn: [53.8, 60.8, "iris"],
  measure: [60.2, 72.8, "zoom"],
  impact: [72.2, 76.2, "iris"],
  close: [75.6, 80.4, "zoom"],
};
export const TRANSITION_S = 0.6;

// biome-ignore format: tabular scenario data
export const CHAPTERS: [s: number, name: string][] = [
  [0, "Hook"], [5.5, "Connect"], [18.8, "Duplicate"], [23.2, "Stale"], [28.4, "Conflict"],
  [39.2, "Why not git"], [47.6, "How it works"], [54, "Learning"], [60.4, "Results"], [72.4, "Impact"], [75.8, "Close"],
];

// One short caption per beat: the picture carries the detail, so a caption only says what to watch. Scenes with
// their own title on screen get none, so the same words never show twice.
// biome-ignore format: one subtitle per row
export const SUBS: [s: number, text: string][] = [
  [0, ""],
  [5.6, "Ash shares a session with the team."],
  [8.8, "Noah joins from his phone."],
  [10.4, "Each laptop joins with one command."],
  [13.6, "Joshua gives his agent a task from his phone."],
  [16.2, "Every agent's work, on one live board."],
  [19.6, "Joshua's agent starts a users table…"],
  [21.6, "…but Noah's agent already built one. Blocked."],
  [23.4, "Ash's agent is about to retry a fix that failed."],
  [24.6, "Warned first, with what worked instead."],
  [28.6, "Noah and Ash build login two different ways."],
  [32.2, "Conflict. Both sides go to Noah."],
  [35, "He picks one from his phone."],
  [36.8, "Ash's agent switches over."],
  [39.2, ""],
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
