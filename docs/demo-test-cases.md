# Demo Test Cases

**Status:** Draft v0.1 · **Owners:** Noah (classifier expectations), Joshua (demo repo, recording) · **Last updated:** 2026-10-23

There are three scenarios, one per verdict type. In each one, three agents work in `lb-demo-shop` at the same time. Each scenario has at least one control the classifier must stay silent on, and it ends with checks we can run. Together they expand the single story in [PLAN.md §8](PLAN.md) into three runs we can rehearse, record and replay separately.

Rules and tiers are from [conflict-classifier-spec.md](conflict-classifier-spec.md). Where a scenario depends on something the spec doesn't decide yet, it points to §5 (spec gaps) below.

---

## 1. Coverage

| | S1 · Duplicate | S2 · Stale | S3 · Conflict |
| --- | --- | --- | --- |
| Tier-0 rule | `claim-overlap` + `topic-owner` | `failed-signature` (deny on `TEST`) | `topic-value`, first against a node, then against a `DECIDE` |
| Tiers 1–2 | Intent similarity → `duplicate`, ready before the first edit | Knowledge similarity → `stale`; judge clears a near miss | Not needed |
| Control (must stay silent) | Two agents edit a `shared` file | Same file and topic as a known failure, different change | Same topic, same value |
| How it resolves | The agent reuses the existing work | The agent switches to the known fix | A human approves on the Resolve panel |
| PLAN §12 tests | Duplicate, Normal control | Stale (similar), Stale (exact) | Conflict, Compatible control |

**Also measured across all three runs:** `PreToolUse` p95 with 3 agents active (target < 150 ms), and "verdict ready before first edit."

**Not covered here** (fixtures/CLI tests, not live beats): Learning (3 dismissals), Fail open, Swappability.

---

## 2. Shared setup

- **Repo:** `lb-demo-shop`. Express API in `src/`, Vite storefront in `web/`, integration test `pnpm test:integration`.
- **Agents:** Noah (auth), Joshua (checkout), Ash (frontend). Each runs on their own laptop, in a clone on their own branch.
- **Reset before each scenario:**
  - check out `demo/s<N>-start` in all three clones
  - wipe the demo workspace
  - replay `fixtures/demo/s<N>/seed.jsonl` (S2 is the only one with a seed)

  This needs an `lb replay --reset`, which isn't in PLAN yet (Ash).
- **Prompts name files and commands on purpose.** That keeps each agent's first tool calls predictable on stage. Vaguer phrasings belong in the labeled fixtures, not the live run.
- **Backup:** record `fixtures/demo/s<N>/scenario.jsonl` from one clean rehearsal per scenario.

**Topic map** (one `.littlebrother.json` for all three, extending spec §5.2):

```jsonc
{
  "topics": {
    "db.users":  { "files": ["db/schema/users.ts", "src/contracts/user.ts"], "owner": "noah", "entry": "src/contracts/user.ts" },
    "web.http":  { "files": ["web/lib/http.ts"], "keywords": ["retry", "backoff", "http client"] },
    "api.cors":  { "files": ["src/server.ts", "web/vite.config.ts"], "keywords": ["cors", "proxy"] },
    "auth.mech": { "files": ["src/auth/**"], "owner": "noah", "keywords": ["jwt", "login", "auth"],
                   "values": { "jwt-bearer":     ["jsonwebtoken", "Authorization: Bearer"],
                               "session-cookie": ["express-session", "req\\.session"] } }
  },
  "shared": ["package.json", "pnpm-lock.yaml", "src/routes/index.ts"]
}
```

Prompts avoid words that hit two topics' keywords at once (for example, "fetch" in a CORS prompt).

---

## 3. Scenarios

### S1 — Duplicate: one users table, one retry helper

**What it shows:** two ways an agent redoes finished work.
- It claims a file someone else owns. Caught by tier 0, synchronously.
- It re-solves a problem someone just solved somewhere else. Caught by tier 1 on the intent, before the first edit.

**Start state (`demo/s1-start`):**
- no `db/schema/users.ts`
- `web/lib/http.ts` has a plain `apiFetch` with no retry
- `web/checkout/submit.ts` calls raw `fetch("/api/checkout")`
- no nodes in the workspace

**Agents**

| Agent | Prompt |
| --- | --- |
| Noah · auth | "Add a users table in db/schema/users.ts (id, email, passwordHash) and export a User type from src/contracts/user.ts. Register GET /me in src/routes/index.ts." |
| Ash · frontend | "Make apiFetch in web/lib/http.ts retry on 5xx with exponential backoff, 3 tries. Add a unit test." |
| Joshua · checkout | **P1:** "Build checkout: create db/schema/users.ts for customers and db/schema/orders.ts linked to it, add POST /checkout, and register it in src/routes/index.ts." **P2:** "POST /checkout from web/checkout/submit.ts sometimes returns 503. Add retry with backoff to that request." |

**Run**

| # | When | Trigger | Expected | Decided by |
| --- | --- | --- | --- | --- |
| 1 | 0:00 | Noah and Ash send prompts | Two intents, `normal` | — |
| 2 | ~0:45 | Noah edits `db/schema/users.ts`, `src/contracts/user.ts` | Live claims on both files | — |
| 3 | 1:00 | Joshua sends P1 | `normal` | — |
| 4 | ~1:30 | Joshua's agent calls `Write db/schema/users.ts` | **Deny** (message A). One `duplicate` row against Noah's `EDIT db.users db/schema/users.ts`. Noah gets an inbox item. | Tier 0: `claim-overlap` 0.95 and `topic-owner` 0.9 both fire (see G5) |
| 5 | ~1:45 | Joshua's agent writes `orders.ts` importing `User` | `normal` | — |
| 6 | ~2:30 | Noah's and Joshua's agents each add a route to `src/routes/index.ts` | `normal`. Shared file, no claim, no row. | **Control** |
| 7 | ~3:00 | Ash's test passes | Ash's `EDIT web.http web/lib/http.ts withRetry` → `succeeded` | — |
| 8 | 4:00 | Joshua sends P2 | Intent gets topic `web.http` (keyword "retry"). Tier 1 vs Ash's intent → `duplicate` stored within ~2 s. Ash gets an inbox item. | Tier 1 (≥ 0.90) or tier 2 (0.80–0.90) |
| 9 | ~4:10 | Joshua's agent's first `Edit web/checkout/submit.ts` | **Deny** (message B). The file inherits topic `web.http` from the intent, so the stored verdict matches (spec §8.2). The agent switches `submit.ts` to `apiFetch`. | Stored verdict |

**Messages**

```
A  [little-brother] duplicate · db.users is owned by Noah (agent active, 1m ago). Import User from src/contracts/user.ts instead of creating db/schema/users.ts.
B  [little-brother] duplicate · Ash's agent added retry with backoff to apiFetch in web/lib/http.ts 1m ago (tests pass). Call apiFetch in submit.ts instead of writing a second retry.
```

**Pass when**
- `classifications` has exactly **2** rows, both `duplicate`:
  - Joshua + Noah, tier `rules`
  - Joshua + Ash, tier `similarity` or `llm`, created before the first `EDIT` event of Joshua's P2 intent
- No row involves `src/routes/index.ts`.
- Each of Noah and Ash has one inbox item, delivered.
- On the merged branches:
  - `rg -l 'pgTable\("users"'` returns one file
  - `rg -l backoff web/` returns only `web/lib/http.ts`
  - `lb verify` passes
- Both rows are auto-labeled `confirmed`, because the agent changed course.

**If it goes wrong**
- The agent retries with `Edit` instead of `Write`: `topic-owner` still fires, so it's still denied.
- The agent dodges with `db/schema/customers.ts`: that derives topic `db.customers`, so tier 0 misses it. Tier 1/2 on the action should still call it `duplicate`. If it doesn't, add it as a fixture.
- Joshua's P1 intent is flagged at the intent stage, because "users" matches the topic name: that's fine. The dedupe key is the same, so there's still one row.

---

### S2 — Stale: don't redo yesterday's dead ends

**What it shows:** failure memory, used two ways.
- A differently-phrased intent is warned before its first edit (similarity).
- An exact repeat of a known-failing command is blocked (signature).
- A near miss on the same file stays silent (judge).

**Seed (`fixtures/demo/s2/seed.jsonl`)**, from "yesterday's" sessions, which have different agent ids:

| Knowledge | Trajectory replayed | Distilled `text` | `signature` |
| --- | --- | --- | --- |
| **K1** (Noah's old session) | Intent 1: `EDIT api.cors src/server.ts cors(origin:*, credentials)` → `TEST` fails twice → `REVERT` → failed. Intent 2: `EDIT api.cors web/vite.config.ts proxy /api` → `TEST` OK | tried cors(origin:*, credentials:true) in src/server.ts → failed: browsers reject wildcard origin with credentials → worked: Vite proxy /api in web/vite.config.ts; call /api/…, not :4000 | the failing `TEST` |
| **K2** (Ash's old session) | `TEST pnpm test:e2e` fails twice with `ECONNREFUSED :4000` → `TEST pnpm test:e2e:ci` OK | tried pnpm test:e2e → failed: API not running on :4000 → worked: pnpm test:e2e:ci (starts the API first) | `sha1(TEST \| pnpm test:e2e)` |

K1 is seeded as two prompts because of G3.

**Start state (`demo/s2-start`):**
- the Vite `/api` proxy from yesterday is in `web/vite.config.ts`
- `web/account/page.ts` calls `http://localhost:4000/account` directly. This is the bug.

**Agents**

| Agent | Prompt |
| --- | --- |
| Ash · frontend | "The account page shows a CORS error calling http://localhost:4000/account. Add CORS middleware to the API so it works." |
| Noah · auth | "Add rate limiting to the API: express-rate-limit in src/server.ts, 100 requests per minute per IP, skip /health." |
| Joshua · checkout | "Add discount code SAVE10 (10% off) to POST /checkout, then run the e2e suite with `pnpm test:e2e`." |

**Run**

| # | When | Trigger | Expected | Decided by |
| --- | --- | --- | --- | --- |
| 1 | 0:00 | Ash sends prompt | Intent topic `api.cors` (keyword "cors"). Tier 1 vs K1 → `stale` stored within ~2 s. | Tier 1 (≥ 0.88) or tier 2 (0.78–0.88) |
| 2 | ~0:10 | Ash's agent's first tool call (a Read) | `PostToolUse` injects message C | Delivery (see G4) |
| 3 | ~0:40 | Ash's agent edits `web/account/page.ts` to call `/api/account` | `normal`. No edit to `src/server.ts`. | — |
| 4 | 0:00 | Noah sends prompt | `normal` | — |
| 5 | ~0:30 | Noah's agent edits `src/server.ts` to add `rateLimit(...)` | The topic is `api.cors` (from the map) and the file is K1's, so tier 1 likely lands between `low` and `high`. The judge says `normal`, and its call is logged. | **Control**, tier 2 |
| 6 | 1:00 | Joshua sends prompt | `normal` | — |
| 7 | ~2:00 | Joshua's agent runs `pnpm test:e2e` | **Deny** (message D). | Tier 0: `failed-signature` 0.97 |
| 8 | ~2:10 | Joshua's agent runs `pnpm test:e2e:ci` | Passes | — |

**Messages**

```
C  [little-brother] stale · Tried: cors(origin:*, credentials) in src/server.ts → failed: browsers reject wildcard origin with credentials. Worked: Vite proxy /api in web/vite.config.ts; call /api/account, not :4000.
D  [little-brother] stale · pnpm test:e2e failed before: API not running on :4000. Run pnpm test:e2e:ci instead (starts the API first).
```

**Pass when**
- `classifications` has exactly **2** rows, both `stale`:
  - Ash vs K1, tier `similarity` or `llm`, delivered before Ash's first `EDIT` event
  - Joshua vs K2, tier `rules`, hook decision `deny`
- There are zero rows for Noah. The Tables view shows the judge's `normal` with its confidence, which is the precision story for judges.
- No executed `pnpm test:e2e` event appears after the deny.
- `rg "origin: ['\"]\*" src/` and `rg "localhost:4000" web/` both return nothing.
- Both rows are auto-labeled `confirmed`. The header shows 2 catches, and tokens saved ≈ the cost of the K1 and K2 trajectories.

**If it goes wrong**
- Ash's agent ignores C and adds `cors()` anyway. `stale` only warns, so this is allowed. If it then succeeds, the row is labeled `false_positive`. Rehearse the prompt until it doesn't.
- The judge flags Noah's rate-limit edit: a false positive on stage. Click Dismiss on the dashboard and keep going, which shows feedback live. Then add it as a fixture and tune.

---

### S3 — Conflict: sessions vs JWT

**What it shows:**
- Two agents build on incompatible auth mechanisms, and both pass their own tests.
- Tier 0 catches it the moment the second mechanism is written. Further edits are paused, and both humans see it.
- The owner approves one side. The losing agent is told by channel, and a third agent that's already compatible is never bothered.

**Depends on G1.** Without it, tier 0 can't see `req.session` in `src/routes/checkout.ts`. See "Fallback" below.

**Start state (`demo/s3-start`):** auth uses `express-session` in `src/auth/session.ts`. That's in git history; there are no nodes. Joshua's checkout branch is fresh.

**Agents**

| Agent | Prompt |
| --- | --- |
| Joshua · checkout | "Make POST /checkout in src/routes/checkout.ts require a logged-in user: read req.session.userId, return 401 if it's missing, and save it on the order. Add a test." |
| Noah · auth | "Switch auth from express-session cookies to JWT bearer tokens: sign with jsonwebtoken in src/auth/jwt.ts, verify in src/auth/middleware.ts, and set req.user." |
| Ash · frontend (sent after resolution) | "Store the token from POST /login and send it as an Authorization: Bearer header from apiFetch in web/lib/http.ts." |

**Run**

| # | When | Trigger | Expected | Decided by |
| --- | --- | --- | --- | --- |
| 1 | 0:00 | Joshua sends prompt | `normal` | — |
| 2 | ~0:40 | Joshua's agent edits `checkout.ts` with `req.session.userId`; the test passes | Primary topic `routes.checkout`. The value match adds `auth.mech=session-cookie` to `payload.topics` (G1). `normal`, because no other value is in play yet. The node ends `succeeded`. | — |
| 3 | 1:30 | Noah sends prompt | `normal`, or the judge flags it at the intent stage. Either way it's the same single row. | — |
| 4 | ~2:00 | Noah's agent's first `Edit src/auth/jwt.ts` (`jsonwebtoken`) | **Deny** Noah (message E). One `conflict` row, against Joshua's `checkout.ts` node. Joshua gets an inbox item and a channel push (message F). | Tier 0: `topic-value` 0.9 |
| 5 | ~2:10 | Noah's agent tries `src/auth/middleware.ts` | Denied again. The event links to the same row, with no new fan-out. | Dedupe (spec §8.1) |
| 6 | ~2:30 | Noah, the human, opens Resolve | The panel shows Joshua's diff (tests pass) next to Noah's proposed `jwt.ts`, taken from the denied `tool_input`. Noah approves `jwt-bearer`. | Human |
| 7 | ~2:35 | Resolution is written | `DECIDE auth.mech jwt-bearer → APPROVED`. Joshua's intent and its actions → `superseded`. The row → `resolved`. Both sessions get message G. | spec §8.3 |
| 8 | ~3:00 | Noah's agent retries its edits | Allowed. Same value as the `DECIDE`. | `topic-value` |
| 9 | ~3:00 | Joshua's agent rewrites `checkout.ts` to use `req.user` | `normal`. If it writes `req.session` again → **deny**, `topic-value` vs `DECIDE` 0.95. *(P1: Droid makes this change on a fix branch.)* | — |
| 10 | ~3:30 | Ash sends prompt; the agent adds `Authorization: Bearer` | Matches the approved value, so `normal`. | **Control** |

**Messages**

```
E  [little-brother] conflict · auth.mech: Joshua's agent uses session-cookie (req.session.userId in src/routes/checkout.ts, tests pass); you use jwt-bearer. Edits on auth.mech are paused until Noah resolves.
F  [little-brother] conflict · auth.mech: Noah's agent is switching to jwt-bearer; your checkout reads req.session.userId. Hold auth changes until Noah resolves.
G  [little-brother] resolved · auth.mech → jwt-bearer (approved by Noah). Use req.user from src/auth/middleware.ts; req.session is going away.
```

**Pass when**
- `classifications` has exactly **1** `conflict` row:
  - `agentIds` = Joshua + Noah, tier `rules`
  - at least 2 linked events
  - status `open` → `resolved`
- Inbox: one conflict item and one resolution item per agent, all delivered by channel.
- Exactly one `DECIDE` node exists on `auth.mech`. Joshua's step-2 trajectory is `superseded`.
- There are zero rows for Ash.
- After Joshua's fix: `rg "req\.session" src/` returns nothing, and `lb verify` passes on the merged branches.

**Timing matters:** if Ash's Bearer edit lands *before* step 7, it's a legitimate second conflict (Ash vs Joshua). Today that would create a second row (G2). Keep Ash's prompt until after resolution on stage, and cover the early case in fixtures.

**Fallback if G1 isn't built:**
1. Run Noah's prompt first.
2. Then change Joshua's prompt to "add a requireUser middleware in src/auth/require-user.ts that reads req.session.userId."

Both `topic-owner` (`duplicate`) and `topic-value` (`conflict`) fire, and `conflict` wins. This still produces one conflict row and a resolve, but:
- Joshua's code never gets written, so there's no "both pass their tests"
- Ash's control is trivially `normal`, because `web/lib/http.ts` isn't in `auth.mech`

---

## 4. Order on stage

Run S1 → S2 → S3. That's the same order as the PLAN §8 beats, and each run takes about 4 minutes. Between runs, reset (§2) and keep the dashboard on the Graph view. If a live run breaks, switch to `lb replay fixtures/demo/s<N>/scenario.jsonl` for that scenario only.

---

## 5. Spec gaps these runs expose

| # | Found in | Gap | Proposal |
| --- | --- | --- | --- |
| **G1** | S3 | `topic-value` only compares nodes whose `topic` is the topic that has values. The PLAN §8 beat puts `req.session.userId` in `src/routes/checkout.ts`. That file derives topic `routes.checkout`, so tier 0 never sees the conflict. | In normalize, run each mapped topic's value regexes over the preview and add hits to `payload.topics`. It's a handful of regexes, well inside the 5 ms budget. `topic-value` reads `payload.topics`; `topic-owner` keeps matching on files only. |
| **G2** | S3 | The dedupe key includes the sorted agent ids. A third agent that hits an open conflict on the same topic opens a second row. | For `conflict`, key on `type + topic`. Append new agents to the open row, and give each one its own inbox item. |
| **G3** | S2 | §9.1 marks the whole intent failed on a `REVERT`, even when the agent then succeeds in the same intent with another approach. Live agents usually do exactly that. | Treat `REVERT` or ≥ 2 failing tests as closing a failed *approach*: distill it, keep the intent open, and fill in "worked" from the later success. |
| **G4** | S2 | §3 says `PreToolUse` returns deny or nothing. §8.2 says a stored `stale` verdict is delivered "as context" there. If the agent's first tool call is an Edit, the warning only arrives after it. | Check whether `PreToolUse` can return `additionalContext` in our Claude Code version. If it can't, push `stale` over the channel as soon as tier 1 decides. |
| **G5** | S1 | `claim-overlap` and `topic-owner` both return `duplicate`, and there's no tie-break. | Same severity → higher confidence wins (`claim-overlap`, 0.95), and the `reason` mentions the other. |
