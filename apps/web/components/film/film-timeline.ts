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
  measure: [65.8, 81.4, "zoom"],
  impact: [80.8, 84.8, "iris"],
  close: [84.2, 89, "zoom"],
};
export const TRANSITION_S = 0.6;

// biome-ignore format: tabular scenario data
export const CHAPTERS: [s: number, name: string][] = [
  [0, "Hook"], [ST + 5.5, "Connect"], [ST + 18.8, "Duplicate"], [ST + 23.2, "Stale"], [ST + 28.4, "Conflict"],
  [44.8, "Why not git"], [53.2, "How it works"], [59.6, "Learning"], [66, "Results"], [81, "Impact"], [84.4, "Close"],
];

// One short caption per beat: the picture carries the detail, so a caption only says what to watch. Scenes with
// their own title on screen get none, so the same words never show twice.
// biome-ignore format: one subtitle per row
export const SUBS: [s: number, text: string][] = [
  [0, ""],
  [ST + 5.6, "Ash shares a session with the team."],
  [ST + 8.8, "Noah joins from his phone."],
  [ST + 10.4, "Each laptop joins with one command."],
  [ST + 13.6, "Joshua gives his agent a task from his phone."],
  [ST + 16.2, "Every agent's work, on one live board."],
  [ST + 19.6, "Joshua's agent starts a users table…"],
  [ST + 21.6, "…but Noah's agent already built one. Blocked."],
  [ST + 23.4, "Ash's agent is about to retry a fix that failed."],
  [ST + 24.6, "Warned first, with what worked instead."],
  [ST + 28.6, "Noah and Ash build login two different ways."],
  [ST + 32.2, "Conflict. Both sides go to Noah."],
  [ST + 35, "He picks one from his phone."],
  [ST + 36.8, "Ash's agent switches over."],
  [44.8, ""],
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
