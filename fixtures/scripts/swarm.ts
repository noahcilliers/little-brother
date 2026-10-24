/**
 * Swarm scenario for scale demos: N agents start together and each loops tasks → reads → edits → tests against
 * lb-demo-shop. A seeded random drives everything, and `overlap` is the chance that a step deliberately
 * collides: creating a shared file another agent creates too, or trying a known-failing approach.
 */
import { Story } from "./events";
import { serverWithCors, shop } from "./snippets";
import { jsdomFailedOutput, jsdomNew, jsdomOld, passedUnitOutput } from "./snippets-team";

export type SwarmOptions = { agents: number; overlap: number; seed: number; minTasks: number; maxTasks: number };
export const SWARM_DEFAULTS: SwarmOptions = { agents: 8, overlap: 0.25, seed: 1, minTasks: 3, maxTasks: 5 };

const NAMES = ["ava", "ben", "cam", "dev", "eli", "fay", "gus", "hana", "ivy", "jon", "kai", "lia", "max", "nia"];
const GOALS = [
  ["rate limiting", "Add rate limiting to the API"],
  ["audit log", "Record an audit log of admin actions"],
  ["coupons", "Support coupon codes at checkout"],
  ["inventory", "Track product inventory"],
  ["reviews", "Let shoppers review products"],
  ["wishlist", "Add a wishlist"],
  ["admin", "Add an admin dashboard API"],
  ["metrics", "Expose request metrics"],
] as const;
const READS = ["package.json", "README.md", "tsconfig.json", "src/index.ts", "db/schema/products.ts", "web/src/App.tsx"];
/** Files several agents may each decide to create: the duplicate collisions. */
const SHARED = ["src/shared/logger.ts", "src/shared/money.ts", "src/shared/retry.ts", "src/shared/feature-flags.ts"];
/** Known-failing approaches: the first agent fails and learns, later ones repeat it (stale). */
const TRAPS = [
  { rel: "vitest.config.ts", old: jsdomOld, new: jsdomNew, output: jsdomFailedOutput },
  { rel: "src/server.ts", old: shop("src/server.ts"), new: serverWithCors, output: "AssertionError: browsers reject Access-Control-Allow-Origin: * when credentials are allowed" },
];
const FAILING_COMMAND = { command: "npm run db:migrate", output: 'npm ERR! Missing script: "db:migrate"' };

/** mulberry32: tiny, fast, good enough for reproducible demo data. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const swarmHandles = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `${NAMES[i % NAMES.length]}${i >= NAMES.length ? Math.floor(i / NAMES.length) + 1 : ""}`);

const camel = (s: string) => s.replace(/[^a-z0-9]+(.)/gi, (_, c: string) => c.toUpperCase());
const moduleFor = (handle: string, fn: string, note: string) =>
  `/** ${note} (${handle}). */\nexport function ${fn}(input: string): string {\n  return \`\${input}:${handle}\`;\n}\n`;

/**
 * Agents are generated one after another, each on its own clock. The first agent generated to take a collision
 * (a shared file, a trap) is its pioneer; later ones are scheduled after the pioneer's create (or lesson) on the
 * shared timeline, so their denial is certain and they get only a PreToolUse line, as a denied call would.
 */
export function generateSwarm(opts: Partial<SwarmOptions> = {}): Story {
  const o = { ...SWARM_DEFAULTS, ...opts };
  const rand = rng(o.seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const between = (lo: number, hi: number) => Math.round(lo + rand() * (hi - lo));
  const story = new Story();
  const created = new Map<string, string>(); // shared path → the pioneer's create step
  const lessons = new Map<string, string>(); // trap file → the pioneer's Stop step (its lesson follows)

  for (const [i, as] of swarmHandles(o.agents).entries()) {
    const [slug, goal] = GOALS[i % GOALS.length] ?? GOALS[0];
    const file = slug.replace(/ /g, "-");
    story.sessionStart(`${as}-00-start`, between(0, 900), as);
    story.prompt(`${as}-00-prompt`, between(600, 1200), as, goal.toLowerCase());
    const tasks = between(o.minTasks, o.maxTasks);
    let trapped: string | undefined;
    for (let k = 1; k <= tasks; k++) {
      const id = `${as}-${String(k).padStart(2, "0")}`;
      const done = story.task(`${id}-task`, between(500, 1500), as, `${goal}: part ${k}`, `${slug} step ${k}`);
      for (let r = between(1, 2); r > 0; r--) story.read(`${id}-read${r}`, between(600, 1800), as, pick(READS));
      const rel = rand() < o.overlap ? pick(SHARED) : undefined;
      const mine = rel !== undefined && created.get(rel)?.startsWith(`${as}-`);
      if (rel && !mine) {
        const first = created.get(rel);
        if (first) story.after(as, first, 1500);
        const content = moduleFor(as, camel(rel.split("/").pop()?.replace(/\.ts$/, "") ?? "shared"), goal);
        story.write(`${id}-shared`, between(1000, 2500), as, rel, content, first !== undefined);
        if (!first) created.set(rel, `${id}-shared.post`);
      } else {
        story.write(`${id}-write`, between(1000, 2500), as, `src/swarm/${as}/${file}-${k}.ts`, moduleFor(as, `${camel(slug)}${k}`, goal));
      }
      if (rand() < o.overlap / 2) {
        story.bash(`${id}-migrate`, between(800, 1500), as, FAILING_COMMAND.command, "Run migrations", FAILING_COMMAND.output, false);
      }
      if (!trapped && rand() < o.overlap) {
        const trap = pick(TRAPS);
        const lesson = lessons.get(trap.rel);
        if (lesson) story.after(as, lesson, 3000);
        story.edit(`${id}-trap`, between(1000, 2000), as, trap.rel, trap.old, trap.new, lesson !== undefined);
        trapped = trap.rel;
        if (!lesson) {
          story.bash(`${id}-trap-test`, between(1000, 1800), as, "npm test", "Run unit tests", trap.output, false);
          story.edit(`${id}-trap-revert`, between(1500, 2500), as, trap.rel, trap.new, trap.old);
        }
      }
      story.bash(`${id}-test`, between(1000, 2000), as, "npm test", "Run unit tests", passedUnitOutput([`test/unit/${file}.test.ts`]), true);
      done(`${id}-task.done`, between(300, 800));
    }
    story.stop(`${as}-98-stop`, between(500, 1200), as, `${goal}: done in ${tasks} steps.`);
    if (trapped && !lessons.has(trapped)) lessons.set(trapped, `${as}-98-stop`);
  }
  const last = story.lines[story.lines.length - 1]?.step ?? "";
  for (const as of swarmHandles(o.agents)) {
    story.after(as, last, 500);
    story.sessionEnd(`${as}-99-end`, 0, as);
  }
  return story;
}
