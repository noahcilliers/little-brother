/**
 * Regenerates fixtures/scenario.jsonl and fixtures/hooks/*.json from the demo repo's real files.
 * Run from the repo root: `npx tsx fixtures/scripts/build-scenario.ts`. Step ids match fixtures/expected.md.
 *
 * Six agents start within the same second and work at once, each on its own clock (see Story). Cross-agent
 * beats are pinned with `story.after`, and the checks at the end keep the timing the classifier needs.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Story } from "./events";
import * as team from "./story-team";
import * as trio from "./story-trio";
import { transcriptsFor } from "./transcripts";

// Think time between an agent's steps; 1.85 puts the whole run at about a minute at speed 1.
const story = new Story(1.85);

// Six laptops, six sessions within one second, six prompts.
story.sessionStart("01-noah-start", 0, "noah");
story.sessionStart("02-joshua-start", 100, "joshua");
story.sessionStart("03-ash-start", 200, "ash");
story.sessionStart("M00-maya-start", 300, "maya");
story.sessionStart("L00-leo-start", 400, "leo");
story.sessionStart("P00-priya-start", 500, "priya");
story.prompt("04-noah-prompt", 900, "noah", "build the user auth workflow");
story.prompt("05-joshua-prompt", 900, "joshua", "build the checkout backend");
story.prompt("06-ash-prompt", 900, "ash", "build the frontend");
story.prompt(
  "M00-maya-prompt",
  900,
  "maya",
  "add Stripe payments: an Order type and a webhook that marks orders paid",
);
story.prompt("L00-leo-prompt", 900, "leo", "add product search: an API endpoint and a search box");
story.prompt(
  "P00-priya-prompt",
  900,
  "priya",
  "set up the mailer and tested templates for transactional mail",
);

// Everyone works at once; story.after() inside each part waits for the beat it depends on.
trio.noahFirstPrompt(story);
trio.ashFirstPrompt(story);
team.maya(story);
team.priyaFirstPrompt(story);
team.leo(story);
trio.joshuaUntilSession(story);
team.mayaTest(story);
trio.ashCors(story);
team.priyaOrders(story);
trio.conflict(story);
trio.joshuaAfterDecision(story);

const lastStep = story.lines[story.lines.length - 1]?.step ?? "";
const ends: [string, string][] = [
  ["29-noah-end", "noah"],
  ["30-joshua-end", "joshua"],
  ["31-ash-end", "ash"],
  ["M99-maya-end", "maya"],
  ["L99-leo-end", "leo"],
  ["P99-priya-end", "priya"],
];
ends.forEach(([step, as], i) => {
  story.after(as, lastStep, 500 + i * 150);
  story.sessionEnd(step, 0, as);
});

/** Timing the beats rely on: [earlier step, later step, minimum gap in ms]. */
const ORDER: [string, string, number][] = [
  ["07-noah-users.post", "14-joshua-users.pre", 1000], // duplicate needs Noah's create first
  ["13-noah-stop", "16-ash-cors-prompt", 3000], // the lesson is distilled before Ash's prompt
  ["16-ash-cors-prompt", "17-ash-cors.pre", 2400], // the stale warning can arrive before the edit
  ["19-joshua-session.post", "21-noah-jwt.pre", 1000], // conflict: the cookie session exists first
  ["21-noah-jwt.post", "22-joshua-routes-cookie.pre", 8000], // the async judge has its verdict
  ["22-joshua-routes-cookie.pre", "23-noah-decision", 1500],
  ["23-noah-decision", "24-joshua-session-fix.pre", 1000],
  ["M05-maya-webhook.post", "32-joshua-webhook.pre", 1000], // duplicate webhook
  ["32-joshua-webhook.pre", "M06-maya-webhook-test.pre", 1000], // Maya's test only after the denied duplicate
  ["M02-maya-order-type.post", "P12-priya-order-email.pre", 1000], // ordering: Order is being created
  ["P10-priya-stop", "L06-leo-jsdom.pre", 3000], // stale: Priya's lesson exists
];
for (const [a, b, gap] of ORDER) {
  const d = story.atOf(b) - story.atOf(a);
  if (d < gap) throw new Error(`${a} → ${b} is ${d} ms, needs ≥ ${gap} ms`);
  console.log(
    `${(story.atOf(b) / 1000).toFixed(1).padStart(5)} s  ${b} (${(d / 1000).toFixed(1)} s after ${a})`,
  );
}

const out = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
// Stop/SessionEnd lines carry a transcript snapshot, so replay prices tool calls as a live session would.
const lines = story.lines;
const transcripts = transcriptsFor(lines);
rmSync(out("transcripts"), { recursive: true, force: true });
mkdirSync(out("transcripts"));
for (const [step, jsonl] of transcripts) writeFileSync(out(`transcripts/${step}.jsonl`), jsonl);
const withTranscripts = lines.map((l) =>
  transcripts.has(l.step) ? { ...l, transcript: `transcripts/${l.step}.jsonl` } : l,
);
writeFileSync(out("scenario.jsonl"), `${withTranscripts.map((l) => JSON.stringify(l)).join("\n")}\n`);

/** One standalone payload per hook event, picked from the story. */
const samples: Record<string, string> = {
  "session-start": "01-noah-start",
  "user-prompt-submit": "16-ash-cors-prompt",
  "pre-tool-use-write": "14-joshua-users.pre",
  "pre-tool-use-edit": "17-ash-cors.pre",
  "pre-tool-use-bash": "09-noah-test.pre",
  "post-tool-use-bash": "12-noah-test.post",
  "post-tool-use-failure-bash": "09-noah-test.post",
  stop: "13-noah-stop",
  "session-end": "29-noah-end",
  "task-created": "T21-noah-jwt.created",
  "task-completed": "T21-noah-jwt.done",
  "post-tool-use-task-update": "T21-noah-jwt.start",
};
for (const [name, step] of Object.entries(samples)) {
  const line = story.lines.find((l) => l.step === step);
  if (!line || !("input" in line)) throw new Error(`no hook payload for ${step}`);
  writeFileSync(out(`hooks/${name}.json`), `${JSON.stringify(line.input, null, 2)}\n`);
}
const seconds = (story.atOf(ends[ends.length - 1]?.[0] ?? "") / 1000).toFixed(1);
console.log(
  `wrote ${story.lines.length} scenario lines (${seconds} s at speed 1) and ${Object.keys(samples).length} hook fixtures`,
);
