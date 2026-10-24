// What the film says, its chapters, and when the decision popup plays. Times are story seconds.

// biome-ignore format: tabular scenario data
export const SCENES: [s: number, text: string][] = [
  [0, "Ash, Noah and Joshua each start Claude Code on lb-demo-shop. Every agent sees only its own session."],
  [4.4, "Little Brother draws every goal and task on one timeline, with the tokens each step cost."],
  [7.4, "Noah's agent tries wildcard CORS. Browsers reject it; the failure becomes a lesson."],
  [10.2, "Joshua's agent starts a users table. Noah's agent already built one."],
  [11.4, "Denied before the write. Joshua imports Noah's User instead and saves ~6k tokens."],
  [15.8, "Ash asks for CORS middleware: the path Noah's agent already proved fails."],
  [17.4, "Warned before the first edit, with what worked. Ash goes straight to the Vite proxy."],
  [21.8, "Noah switches token issuing to JWT bearer. Ash builds login on cookie sessions."],
  [26, "Both change auth.mechanism. Each passes its own tests; merged, login breaks."],
  [27.2, "The owner gets both sides as a diff and picks one."],
  [32.6, "Noah keeps JWT. Ash's session gets the decision and only the superseded step is redone."],
  [39.4, "lb verify merges all three branches and runs the tests. Nothing left to fix at merge."],
  [42.6, "Three catches before push. Same three agents, same prompts, ~15k tokens saved."],
];

// biome-ignore format: tabular scenario data
export const CHAPTERS: [s: number, name: string][] = [
  [0, "Setup"], [10.2, "Duplicate"], [15.8, "Stale"], [21.8, "Conflict"], [30.6, "Resolve"], [39.4, "Verify"],
];

/** The decision popup: slides in, the owner's pointer travels to "Keep", clicks, the popup closes. */
export const POPUP = { open: 27, cursorIn: 29.4, cursorAt: 31, click: 31.6, close: 32.4 } as const;
