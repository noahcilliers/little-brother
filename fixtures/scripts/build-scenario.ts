/**
 * Regenerates fixtures/scenario.jsonl and fixtures/hooks/*.json from the demo repo's real files.
 * Run from the repo root: `npx tsx fixtures/scripts/build-scenario.ts`. Step ids match fixtures/expected.md.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Story } from "./events";
import * as s from "./snippets";

const story = new Story();

// Setup: three laptops, three prompts.
story.sessionStart("01-noah-start", 0, "noah");
story.sessionStart("02-joshua-start", 300, "joshua");
story.sessionStart("03-ash-start", 300, "ash");
story.prompt("04-noah-prompt", 800, "noah", "build the user auth workflow");
story.prompt("05-joshua-prompt", 400, "joshua", "build the checkout backend");
story.prompt("06-ash-prompt", 400, "ash", "build the frontend");

// Noah's agent: users table, then the CORS dead end and the proxy that works.
story.write("07-noah-users", 1500, "noah", "db/schema/users.ts", s.solution("db/schema/users.ts"));
story.edit("08-noah-cors", 1200, "noah", "src/server.ts", s.shop("src/server.ts"), s.serverWithCors);
story.bash("09-noah-test", 1000, "noah", "npm test", "Run unit tests", s.noahFailedTestOutput, false);
story.edit("10-noah-revert-cors", 1500, "noah", "src/server.ts", s.serverWithCors, s.shop("src/server.ts"));
story.edit("11-noah-proxy", 800, "noah", "web/vite.config.ts", s.viteProxyOld, s.viteProxyNew);
story.bash("12-noah-test", 1000, "noah", "npm test", "Run unit tests", s.noahPassedTestOutput, true);
story.stop(
  "13-noah-stop",
  600,
  "noah",
  'Added `db/schema/users.ts` (in-memory users table, seeded demo@shop.dev). I first tried `cors({ origin: "*", credentials: true })` in src/server.ts, but `npm test` failed: browsers reject `Access-Control-Allow-Origin: *` when credentials are allowed. I reverted it and added a Vite `/api` proxy in web/vite.config.ts instead, so the storefront calls the API same-origin. Unit tests pass.',
);

// Duplicate beat: Joshua's agent plans its own users table, is denied, imports Noah's User instead.
story.write("14-joshua-users", 3000, "joshua", "db/schema/users.ts", s.joshuaUsersTable, true);
story.edit(
  "15-joshua-cart",
  1500,
  "joshua",
  "src/checkout/cart.ts",
  s.shop("src/checkout/cart.ts"),
  s.solution("src/checkout/cart.ts"),
);

// Stale beat: Ash's agent sets out to add the CORS middleware Noah's agent proved fails.
story.prompt(
  "16-ash-cors-prompt",
  1500,
  "ash",
  "add CORS middleware to the API so the storefront can call it",
);
story.edit("17-ash-cors", 2500, "ash", "src/server.ts", s.shop("src/server.ts"), s.serverWithCors, true);
story.edit("18-ash-proxy", 1200, "ash", "web/vite.config.ts", s.viteProxyOld, s.viteProxyNew);

// Conflict beat: checkout reads a session cookie while auth moves to JWT bearer.
story.write("19-joshua-session", 1500, "joshua", "src/checkout/session.ts", s.joshuaCookieSession);
story.prompt("20-noah-prompt", 1000, "noah", "finish login: issue tokens and protect /api/me");
story.edit(
  "21-noah-jwt",
  1200,
  "noah",
  "src/auth/issue-token.ts",
  s.shop("src/auth/issue-token.ts"),
  s.solution("src/auth/issue-token.ts"),
);
story.edit(
  "22-joshua-routes-cookie",
  4000,
  "joshua",
  "src/checkout/routes.ts",
  s.joshuaRoutesCookieOld,
  s.joshuaRoutesCookieNew,
  true,
);
story.mcp("23-noah-decision", 2000, "noah", "post_decision", {
  topic: "auth.mechanism",
  value: "jwt-bearer",
  rationale:
    "Stateless JWT in `Authorization: Bearer`; no session store. Checkout must use requireUser/currentUser from src/auth/require-user.ts.",
});
story.edit(
  "24-joshua-session-fix",
  2500,
  "joshua",
  "src/checkout/session.ts",
  s.joshuaCookieSession,
  s.joshuaSessionFixed,
);
story.edit(
  "25-joshua-routes",
  1000,
  "joshua",
  "src/checkout/routes.ts",
  s.shop("src/checkout/routes.ts"),
  s.solution("src/checkout/routes.ts"),
);

// Wrap up.
story.stop(
  "26-joshua-stop",
  1000,
  "joshua",
  "Checkout backend done: cart keyed by `User`, `POST /api/checkout` behind auth's `requireUser` (JWT bearer, per Noah's decision on auth.mechanism).",
);
story.stop(
  "27-ash-stop",
  500,
  "ash",
  "Storefront calls the API through the Vite `/api` proxy; no CORS middleware needed.",
);
story.stop(
  "28-noah-stop",
  500,
  "noah",
  "Login issues a JWT (`jwt.sign({ userId })`); `/api/me` is protected by `requireUser`.",
);
story.sessionEnd("29-noah-end", 500, "noah");
story.sessionEnd("30-joshua-end", 200, "joshua");
story.sessionEnd("31-ash-end", 200, "ash");

const out = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
writeFileSync(out("scenario.jsonl"), `${story.lines.map((l) => JSON.stringify(l)).join("\n")}\n`);

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
};
for (const [name, step] of Object.entries(samples)) {
  const line = story.lines.find((l) => l.step === step);
  if (!line || !("input" in line)) throw new Error(`no hook payload for ${step}`);
  writeFileSync(out(`hooks/${name}.json`), `${JSON.stringify(line.input, null, 2)}\n`);
}
console.log(`wrote ${story.lines.length} scenario lines and ${Object.keys(samples).length} hook fixtures`);
