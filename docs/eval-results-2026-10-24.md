# Eval results — 2026-10-24

Live detection benchmark for Little Brother, run on the local backend with the classifier's rule tier
alone (baseline) and then with Gemini embeddings and the Gemini judge switched on.

## Summary

Switching on Gemini took recall from **75% to 100%** and cut median time-to-flag from **10.7 s to
3.4 s**, at the cost of **one false positive** in 12 control runs (precision 100% → 97%).

| Metric                                   | Rules only (baseline) | Rules + Gemini (judge run) |
| ---------------------------------------- | --------------------- | -------------------------- |
| Runs                                     | 16 (1 per case)       | 48 (3 per case)            |
| Recall: caught, any kind                 | 75% (9/12)            | **100%** (36/36)           |
| Strict recall: caught, right kind        | 67% (8/12)            | **100%** (36/36)           |
| Precision                                | 100% (9/9)            | **97%** (36/37)            |
| Kind accuracy                            | 89% (8/9)             | **100%** (36/36)           |
| Flagged before the later agent's 1st edit | 78% (7/9)            | **97%** (35/36)            |
| Median time to flag                      | 10.7 s                | **3.4 s**                  |
| False positives                          | 0                     | 1                          |
| Control runs with any flag               | 0 / 4                 | 1 / 12                     |
| Agent cost / wall time                   | $1.75 / 6.1 min       | $5.91 / 25.9 min           |

With this few data points the 95% Wilson ranges are wide: judge-run recall is **90–100%** and
precision is **86–99.5%**.

## What was measured

Little Brother watches several Claude Code sessions on one repo and flags work that will collide. The
eval checks how many planted collisions it flags (recall), how many of its flags are real (precision),
whether it names the right kind, and how early the flag arrives.

Each **case** runs two headless Claude Code agents (`claude -p`, model `sonnet`) on the demo app
`demo/shop`. Each agent gets its own git branch and worktree and a prompt that clashes with the other
agent's on purpose. The real Little Brother plugin is loaded, so its hooks report every tool call to the
backend, which classifies the work as it happens. Afterwards the harness reads back what was flagged,
merges the branches, and runs checks to confirm whether the clash actually happened.

Only the **`pointed`** prompt variant ran. Those prompts name the exact files to touch. The
**`natural`** variant, which describes the task without naming files, has not run yet.

### Kinds of finding

- **duplicate**: two agents build the same thing.
- **conflict**: incompatible approaches (`intent_contradiction`), edits to the same lines
  (`textual_conflict`), a change that breaks the other branch after merge (`semantic_conflict`), or one
  branch building on something the other hasn't landed yet (`ordering_dependency`).
- **stale**: an agent retries an approach an earlier session already tried and saw fail
  (`repeats_failure`).
- **control**: nothing should be flagged. Any flag is a false positive.

## The 16 cases

Agent handles are just labels. "Starts after" means the second agent launches once the first makes its
first edit (or, for stale cases, 10 s after the first agent exits).

| Case                       | Kind expected                       | Agents (2nd starts after)          | What the agents are told to do                                                                                     | Evidence the clash happened                          |
| -------------------------- | ----------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `dup-users-table`          | duplicate                           | noah → joshua (noah's 1st edit)    | Both create `db/schema/users.ts` with an in-memory users Map and `findUserByEmail`                                 | joshua touched the file; two lookups; merge conflict |
| `dup-order-model`          | duplicate                           | maya → joshua (maya's 1st edit)    | Both define `Order` in `src/contracts/order.ts` and an orders table in `db/schema/orders.ts`                        | joshua touched both; two types; merge conflict       |
| `dup-order-email`          | duplicate                           | priya → maya (priya's 1st edit)    | Both write `sendOrderConfirmation` in `src/notify/order-email.ts`                                                   | maya touched it; two senders; merge conflict         |
| `conflict-auth-mechanism`  | conflict · intent_contradiction     | noah → joshua (noah's 1st edit)    | noah: JWT bearer auth, no cookies. joshua: server sessions in an httpOnly cookie, no JWTs. Same `src/auth/*` files  | merge conflict, and both mechanisms present          |
| `conflict-cors-vs-proxy`   | conflict · intent_contradiction     | ash → noah (ash's 1st edit)        | ash: Vite proxy in `web/vite.config.ts`, no CORS. noah: CORS in `src/server.ts`, don't touch Vite. Different files  | both fixes present                                   |
| `conflict-product-sort`    | conflict · textual_conflict         | leo → joshua (leo's 1st edit)      | Same handler in `src/catalog/routes.ts`: sort by name vs sort by price                                              | merge conflict, and both sorts present               |
| `semantic-user-rename`     | conflict · semantic_conflict        | noah → ash (noah's 1st edit)       | noah renames `User.name` → `displayName`; ash writes a new component that uses `user.name`                         | typecheck fails on the merged branch                 |
| `semantic-token-signature` | conflict · semantic_conflict        | noah → joshua (noah's 1st edit)    | noah adds a required `opts` argument to `issueToken`; joshua writes a login route that calls `issueToken(user)`     | merged typecheck fails, or merge conflict            |
| `ordering-order-type`      | conflict · ordering_dependency      | maya → priya (maya's 1st edit)     | maya creates the `Order` type; priya imports it from maya's branch before it lands                                 | typecheck fails on priya's branch                    |
| `ordering-require-admin`   | conflict · ordering_dependency      | noah → leo (noah's 1st edit)       | noah creates `requireAdmin` middleware; leo uses it in a new admin route before it lands                           | typecheck fails on leo's branch                      |
| `stale-cors-wildcard`      | stale · repeats_failure             | priya → ash (10 s after priya exits) | priya tries CORS `origin: '*'` with credentials, the test fails, she reverts. ash is asked to do the same thing   | ash wrote the wildcard and touched `src/server.ts`   |
| `stale-jsdom-env`          | stale · repeats_failure             | priya → ash (10 s after priya exits) | priya sets vitest env to `jsdom` (not installed), the test fails, she reverts. ash is asked to do the same thing  | ash set jsdom and touched `vitest.config.ts`         |
| `control-unrelated`        | none                                | leo + priya (together)             | Search endpoint in catalog vs mailer outbox in notify                                                             | –                                                    |
| `control-same-mechanism`   | none                                | noah → joshua (noah's 1st edit)    | Both agree on JWT: noah writes `issueToken`, joshua protects checkout with `requireUser`                           | –                                                    |
| `control-neighbours`       | none                                | ash + joshua (together)            | Storefront copy changes vs cart API, without changing the shared cart shape                                       | –                                                    |
| `control-config-and-tests` | none                                | priya → ash (priya's 1st edit)     | Test timeout in `vitest.config.ts` vs a new unit test file                                                        | –                                                    |

The exact prompts are in [apps/evals/cases/](../apps/evals/cases/). The `pointed` prompts are also
copied in the appendix below.

## How it was run

### Setup

- **Machine:** Noah's Mac (darwin), Claude Code 2.1.310, `claude -p` signed in with Noah's account.
- **Backend:** local anonymous Convex deployment (`anonymous:anonymous-agent`), site
  `http://127.0.0.1:3211`, started with `CONVEX_AGENT_MODE=anonymous npx convex dev` in
  `packages/backend`.
- **Deployment env:** `LB_ALLOW_INVITE=1` for both runs. The judge run also had `GEMINI_API_KEY`. No
  `CLASSIFIER_JUDGE` or `CLASSIFIER_EMBEDDER` override, so both default to Gemini.
- **Classifier models (code defaults):** embeddings `gemini-embedding-001`; judge `gemini-3.5-flash-lite`,
  falling back to `gemini-3.1-flash-lite`.
- **Agent model and limits (harness defaults):** `sonnet`, 30 turns, $1.50 budget and 12 min per agent;
  20 s settle after the last agent exits.
- **Code version:** the classifier code was the same for both runs. The connector was not: the judge
  run used a build that includes `2842cfe` ("Attribute MCP calls to their own Claude session"), which
  landed between the two runs. The baseline ran on an older build. That change affects which session
  MCP calls are credited to, not how pairs are classified.
- **pnpm was not on the PATH**, so the judge runs called the CLI directly with
  `./node_modules/.bin/tsx src/cli.ts`, which is what `pnpm --filter @lb/evals eval` runs.

### Commands

Baseline, rules only. This ran at 04:09 local time on Oct 24 in an earlier session, before the Gemini
key was set. Its exact command line wasn't saved. The report records `pointed`, 1 run per case, model
`sonnet`, and the output folder `smoke-pointed`, which matches the README's smoke command:

```bash
pnpm --filter @lb/evals eval --variant pointed --runs 1 --concurrency 4
```

Turn on the judge and embeddings (Noah ran this; the key is never printed):

```bash
cd packages/backend && CONVEX_AGENT_MODE=anonymous npx convex env set GEMINI_API_KEY '<key>'
```

Probe: one case to confirm Gemini calls succeed before spending on the full suite. It also rebuilt the
connector:

```bash
cd apps/evals && ./node_modules/.bin/tsx src/cli.ts --cases conflict-cors-vs-proxy --variant pointed --runs 1 --concurrency 1 --out results/judge-probe
```

Full judge run, compared against the baseline:

```bash
cd apps/evals && ./node_modules/.bin/tsx src/cli.ts --variant pointed --runs 3 --concurrency 2 --no-build --out results/judge-pointed-x3 --compare results/smoke-pointed
```

### What each run does

1. Copies `demo/shop` into a new git repo under `/tmp/lb-evals/<tag>/`, with one branch and worktree
   per agent. It sits outside this checkout so agents don't load our CLAUDE.md.
2. Opens a fresh Little Brother session in its own room (`evals:openRun`), so memory doesn't leak
   between runs.
3. Starts each agent with `claude -p` and a copy of `plugin/` wired to this checkout's connector build.
   The second agent waits for the first one's first edit, or for it to finish.
4. Holds back `SessionEnd` until everyone is done, because an agent that has exited drops out of every
   comparison.
5. Waits 20 s, reads the session's classifications (`evals:snapshot`), commits each worktree, merges all
   branches, and runs the case's checks.

### Scoring

Flags are grouped by agent pair.

| Outcome        | Meaning                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| hit            | A flag on the expected pair, with the expected kind                         |
| mislabel       | A flag on the expected pair, with another kind                              |
| miss           | No flag, and the checks show the clash happened                             |
| didn't happen  | No flag, and the checks show no clash: left out of recall                   |
| false positive | A flag on any other pair, or any flag in a control (one per pair, not per row) |

- Recall = (hit + mislabel) / (hit + mislabel + miss)
- Strict recall = hit / (hit + mislabel + miss)
- Precision = (hit + mislabel) / (hit + mislabel + false positives)
- Time to flag = seconds from the later agent's prompt to the first matching flag

## Results by case

| Case                       | Rules only | + Gemini | Tier that caught it (Gemini run) | Median time to flag (rules → Gemini) |
| -------------------------- | ---------- | -------- | -------------------------------- | ------------------------------------ |
| `dup-users-table`          | hit        | 3/3 hit  | LLM judge                        | 10.5 s → 2.8 s                       |
| `dup-order-model`          | **miss**   | 3/3 hit  | rule                             | – → 11.8 s                           |
| `dup-order-email`          | hit        | 3/3 hit  | LLM judge                        | 16.1 s → 2.7 s                       |
| `conflict-auth-mechanism`  | hit        | 3/3 hit  | LLM judge                        | 16.3 s → 3.5 s                       |
| `conflict-cors-vs-proxy`   | **miss**   | 3/3 hit  | LLM judge                        | – → 6.1 s                            |
| `conflict-product-sort`    | hit        | 3/3 hit  | LLM judge and rule               | 10.7 s → 4.7 s                       |
| `semantic-user-rename`     | hit        | 3/3 hit  | LLM judge                        | 10.5 s → 3.1 s                       |
| `semantic-token-signature` | hit        | 3/3 hit  | LLM judge                        | 11.2 s → 3.7 s                       |
| `ordering-order-type`      | hit        | 3/3 hit  | LLM judge                        | 10.5 s → 2.9 s                       |
| `ordering-require-admin`   | hit        | 3/3 hit  | LLM judge                        | 7.0 s → 2.4 s                        |
| `stale-cors-wildcard`      | **mislabel** (called it a conflict) | 3/3 hit | rule                    | 37.9 s → 3.2 s                       |
| `stale-jsdom-env`          | **miss**   | 3/3 hit  | LLM judge                        | – → 3.5 s                            |
| `control-unrelated`        | clean      | 3/3 clean | –                               | –                                    |
| `control-same-mechanism`   | clean      | 2/3 clean, **1 FP** | LLM judge             | –                                    |
| `control-neighbours`       | clean      | 3/3 clean | –                               | –                                    |
| `control-config-and-tests` | clean      | 3/3 clean | –                               | –                                    |

Across the Gemini run, 83 of the 138 flagged rows came from the LLM judge and 55 from rules.

A rules-only recheck of the three failing cases (`results/smoke-pointed-recheck`, $0.35) caught 0 of 3.
`stale-cors-wildcard` went from mislabel to miss between the two rules-only runs, which shows how much
single runs vary.

## The false positive

`control-same-mechanism`, run #2. joshua edited the checkout route (`src/checkout/routes.ts`) to add
`requireUser`. At the same time noah was only **reading** `src/auth/issue-token.ts` (an `EXPLORE`
node). The judge flagged an `ordering_dependency` with confidence 0.9 and action `serialize`, saying
joshua's change "relies on the authentication mechanism being explored and defined by OTHER". But a
read-only exploration has nothing to land first, so nothing should have been flagged.

Possible fix: don't send ordering pairs to the judge, or don't accept its ordering verdict, when the
other side is read-only (`EXPLORE`/`READ`).

## Caveats

- **Pointed prompts only.** They name the files, which makes overlap easy to see. The `natural` variant
  is the more realistic test and hasn't run.
- **The suite is saturated.** At 100% recall it can no longer show whether a change helps. It needs
  harder cases, more controls and near-miss negatives.
- **Small sample.** 36 expected clashes and 12 control runs; see the ranges in the summary.
- **Precision is lenient.** Extra wrong-kind flags on an expected pair aren't counted, and in the
  Gemini run **7 of the 36 hits** also had them: all 3 `conflict-auth-mechanism` runs got 2 extra
  `duplicate` rows each, all 3 `dup-order-email` runs got 1–3 extra `conflict` rows, and one
  `dup-order-model` run got 3 extra `conflict` rows. A developer would see those mixed messages. The
  response chosen (block, warn, serialize) isn't scored either.
- **Different connector builds** between the two runs (see Setup).
- **Different run counts:** the baseline had 1 run per case and the Gemini run had 3, so the baseline
  numbers are noisier.

## Next steps

1. Run the `natural` variant with the judge on, 3 runs per case, compared against this run.
2. Fix the read-only ordering false positive and rerun the controls.
3. Add harder cases and near-miss controls, confidence intervals in the report, a per-tier breakdown,
   and scoring for wrong-kind extras and the response chosen.

## Raw results

`apps/evals/results/` is gitignored, so these exist only on this machine:

- `apps/evals/results/smoke-pointed/`: rules-only baseline
- `apps/evals/results/smoke-pointed-recheck/`: rules-only recheck of the 3 failures
- `apps/evals/results/judge-probe/`: one-case Gemini probe
- `apps/evals/results/judge-pointed-x3/`: full Gemini run (`report.md`, `summary.json`, `runs.json`,
  and per-run `run.json` plus each agent's raw `stream.jsonl`)
- `apps/evals/results/judge-pointed-x3.log`: progress log

## Appendix: pointed prompts

### dup-users-table

- **noah:** Create db/schema/users.ts: an in-memory users Map like db/schema/products.ts, seeded with the demo user (id u_demo, email demo@shop.dev, name Demo, password correct-horse stored as a sha256 hex hash via node:crypto), plus findUserByEmail(email) and verifyPassword(user, password). Use the User type from src/contracts/user.ts.
- **joshua:** Checkout needs to look up customers. Create db/schema/users.ts with an in-memory Map of users seeded with demo@shop.dev and a findUserByEmail(email) helper, using the User type from src/contracts/user.ts.

### dup-order-model

- **maya:** Add the order model: export interface Order { id: string; userId: string; items: CartItem[]; totalCents: number; createdAt: string } in src/contracts/order.ts (CartItem from src/checkout/cart.ts), and an in-memory orders Map with createOrder(order) in db/schema/orders.ts.
- **joshua:** Implement POST /api/checkout in src/checkout/routes.ts so it saves an order. Define the Order type in src/contracts/order.ts and an in-memory orders table in db/schema/orders.ts for it. Auth isn't done: use userId 'anonymous' and an empty item list for now.

### dup-order-email

- **priya:** Create src/notify/order-email.ts exporting sendOrderConfirmation(to: string, orderId: string, totalCents: number) that builds a short HTML receipt and sends it with sendMail from src/notify/mailer.ts. Add test/unit/order-email.test.ts that mocks sendMail.
- **maya:** After a payment succeeds we must email a receipt. Create src/notify/order-email.ts with sendOrderConfirmation(to, orderId, totalCents) using sendMail from src/notify/mailer.ts, and call it from a new handlePaymentSucceeded(orderId, email, totalCents) in src/payments/webhook.ts.

### conflict-auth-mechanism

- **noah:** Implement auth with JWT bearer tokens: issueToken in src/auth/issue-token.ts signs { sub: user.id } with jsonwebtoken (secret process.env.JWT_SECRET ?? 'dev-secret'), and requireUser in src/auth/require-user.ts reads 'Authorization: Bearer <token>', verifies it and sets res.locals.user. Don't use cookies.
- **joshua:** Implement auth with server-side sessions: issueToken in src/auth/issue-token.ts creates a random session id stored in an in-memory Map, and requireUser in src/auth/require-user.ts reads it from an httpOnly 'sid' cookie (parse the Cookie header yourself). Don't use JWTs.

### conflict-cors-vs-proxy

- **ash:** The storefront can't reach the API. Fix it on the frontend: add a Vite dev-server proxy in web/vite.config.ts forwarding /api to http://localhost:3001. The API must stay same-origin only, so don't add CORS to it. Run npm test.
- **noah:** The storefront can't reach the API. Fix it on the API: add the cors middleware in src/server.ts allowing origin http://localhost:5173 with credentials: true. Don't touch the Vite config. Run npm test.

### conflict-product-sort

- **leo:** In src/catalog/routes.ts make GET /api/products return the products sorted by name, A to Z.
- **joshua:** In src/catalog/routes.ts make GET /api/products return the products sorted by price, cheapest first.

### semantic-user-rename

- **noah:** Rename the User field `name` to `displayName` in src/contracts/user.ts and update every existing use in the repo (src/ and web/). Run npm run typecheck.
- **ash:** Create web/src/Greeting.tsx exporting Greeting({ user }: { user: User }) that renders 'Welcome back, {user.name}!' (User from src/contracts/user.ts), and render it in web/src/App.tsx when signed in. Run npm run typecheck.

### semantic-token-signature

- **noah:** Change issueToken in src/auth/issue-token.ts to issueToken(user: User, opts: { expiresInSec: number }): string, implemented as a base64url JSON token {sub, exp}. opts is required. Run npm run typecheck.
- **joshua:** Implement POST /api/auth/login in src/auth/routes.ts: accept demo@shop.dev / correct-horse (hardcode the user { id: 'u_demo', email, name: 'Demo' }) and return { token: issueToken(user) } using issueToken from src/auth/issue-token.ts. Don't change issue-token.ts.

### ordering-order-type

- **maya:** Create src/contracts/order.ts exporting interface Order { id: string; userId: string; email: string; items: { productId: string; quantity: number }[]; totalCents: number }. Only this file.
- **priya:** Maya is adding the Order type in src/contracts/order.ts on her branch. Write sendOrderConfirmation(order: Order) in src/notify/order-email.ts that emails order.email a receipt via sendMail, importing Order from ../contracts/order. Don't create the Order type yourself.

### ordering-require-admin

- **noah:** Create src/auth/require-admin.ts exporting requireAdmin(req, res, next): Express middleware that answers 403 unless res.locals.user?.email ends with '@shop.dev'. Only this file.
- **leo:** Add DELETE /api/products/:id in src/catalog/routes.ts that removes the product from the products Map, protected by requireAdmin imported from ../auth/require-admin. Noah is writing requireAdmin on his branch; don't write it yourself.

### stale-cors-wildcard

- **priya:** The storefront can't reach the API. Add CORS to the API in src/server.ts using the cors package (already installed) with origin: '*' and credentials: true, then run npm test. If npm test still fails, revert with `git checkout src/server.ts` and stop. Don't try anything else.
- **ash:** npm test fails because the storefront can't reach the API. Add the cors middleware in src/server.ts with origin '*' and credentials: true, then run npm test.

### stale-jsdom-env

- **priya:** Set test.environment to 'jsdom' in vitest.config.ts so React components can be tested, then run npm test. Don't install packages. If npm test fails, revert with `git checkout vitest.config.ts` and stop.
- **ash:** Set the vitest environment to 'jsdom' in vitest.config.ts so we can test React components, then run npm test.

### control-unrelated

- **leo:** Add GET /api/search?q= in src/catalog/routes.ts returning products whose name contains q, case-insensitive.
- **priya:** Implement sendMail in src/notify/mailer.ts so it appends each mail to an exported in-memory `outbox` array and resolves. Add test/unit/mailer.test.ts.

### control-same-mechanism

- **noah:** Implement issueToken in src/auth/issue-token.ts: sign { sub: user.id, email: user.email } with jsonwebtoken using process.env.JWT_SECRET ?? 'dev-secret', expiring in 1h. Only that file.
- **joshua:** Protect POST /api/checkout in src/checkout/routes.ts with requireUser from src/auth/require-user.ts. Auth uses JWT bearer tokens in the Authorization header, which requireUser handles. Only edit src/checkout/routes.ts.

### control-neighbours

- **ash:** In web/src/App.tsx change the Products heading to show the count, e.g. 'Products (3)', and show 'Your cart is empty' under Cart when there are no items. Only the storefront.
- **joshua:** Implement the cart in src/checkout/routes.ts: GET /api/cart returns { items } from an in-memory cart, POST /api/cart/items adds { productId, quantity } and answers 201 with the cart. Use the types in src/checkout/cart.ts. No auth yet.

### control-config-and-tests

- **priya:** In vitest.config.ts set test.testTimeout to 10000 and keep everything else as is. Run npm test.
- **ash:** Add test/unit/api-client.test.ts testing that api.products() in web/src/api.ts calls fetch('/api/products') (stub globalThis.fetch with vi.fn). Run npm test.
